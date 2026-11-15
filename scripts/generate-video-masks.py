"""
生成茶灵视频的"智能渐隐遮罩"（src/assets/video-masks/*.png）。

作用：视频自带背景，与页面背景之间会出现矩形接缝。遮罩让视频四周的纯背景
渐隐成透明、露出页面背景；茶灵、叶子、茶壶等出现过的区域保持完全不透明。

什么时候需要运行：只有替换或新增了 public/videos 下的视频时才需要重新生成。
平时开发、构建都不需要它。

依赖：Python 3、ffmpeg（需在 PATH 中）、numpy、pillow
    pip install numpy pillow

用法（在项目根目录执行，Windows / macOS 通用）：
    python scripts/generate-video-masks.py

运行结束会打印每个阶段"角色落在渐隐区"的检查结果，应全部为 0.0%。
"""

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
VIDEO_DIR = ROOT / 'public' / 'videos'
OUT_DIR = ROOT / 'src' / 'assets' / 'video-masks'

STAGES = {'early': 'zaoqi', 'middle': 'zhongqi', 'late': 'houqi'}
SAMPLE_FPS = 8                # 每秒取样帧数，越高越不会漏掉快速动作
WORK_WIDTH = 360              # 分析与输出宽度；高度按各阶段视频的真实比例计算

# 判定为"角色"的像素：颜色较饱和，或明显偏暗（头发、叶脉）
SATURATION_MIN = 0.16
VALUE_MAX = 0.45

# 角色区域向外保留的余量（像素，基于 360 宽）与羽化半径
KEEP_GROW = 15
KEEP_BLUR = 8

# 纯背景的渐隐宽度（占画面比例）：上方有远山，渐隐更宽
FADE_TOP, FADE_BOTTOM, FADE_SIDE = 0.18, 0.10, 0.13
# 角色越过画面边缘时的柔化宽度，避免被一刀切断
EDGE_SOFTEN = 0.025


def smooth_ramp(length, width):
    x = np.clip(np.arange(length) / max(1.0, width), 0, 1)
    return x * x * (3 - 2 * x)


def edge_fade(width, height, top, bottom, left, right):
    ys = np.minimum(smooth_ramp(height, height * top), smooth_ramp(height, height * bottom)[::-1])
    xs = np.minimum(smooth_ramp(width, width * left), smooth_ramp(width, width * right)[::-1])
    return ys[:, None] * xs[None, :]


def character_mask(image):
    hsv = np.asarray(image.convert('HSV')).astype(float) / 255
    return (hsv[..., 1] > SATURATION_MIN) | (hsv[..., 2] < VALUE_MAX)


def video_size(video):
    probe = subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
         '-show_entries', 'stream=width,height', '-of', 'csv=p=0', str(video)],
        check=True, capture_output=True, text=True,
    )
    width, height = (int(x) for x in probe.stdout.strip().strip(',').split(',')[:2])
    return width, height


def extract_frames(video, target_dir, size):
    pattern = target_dir / f'{video.stem}-%04d.png'
    subprocess.run(
        ['ffmpeg', '-v', 'error', '-y', '-i', str(video),
         '-vf', f'fps={SAMPLE_FPS},scale={size[0]}:{size[1]}', str(pattern)],
        check=True,
    )
    return sorted(target_dir.glob(f'{video.stem}-*.png'))


def main():
    if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
        sys.exit('未找到 ffmpeg / ffprobe，请先安装并加入 PATH。')
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        for stage, folder in STAGES.items():
            videos = sorted((VIDEO_DIR / folder).glob('*.mp4'))
            if not videos:
                sys.exit(f'没有找到 {folder} 阶段的视频')
            sizes = {video_size(v) for v in videos}
            if len(sizes) != 1:
                sys.exit(f'{folder} 阶段的视频尺寸不一致：{sizes}')
            src_w, src_h = sizes.pop()
            width = WORK_WIDTH
            height = round(WORK_WIDTH * src_h / src_w)
            frames = []
            for video in videos:
                frames += extract_frames(video, tmp_dir, (width, height))

            union = np.zeros((height, width), bool)
            for frame in frames:
                union |= character_mask(Image.open(frame))

            keep = Image.fromarray((union * 255).astype('uint8'))
            keep = keep.filter(ImageFilter.MedianFilter(5))          # 去掉零星噪点
            keep = keep.filter(ImageFilter.MaxFilter(KEEP_GROW))     # 向外留出余量
            keep = keep.filter(ImageFilter.GaussianBlur(KEEP_BLUR))  # 柔和过渡
            keep = np.clip(np.asarray(keep).astype(float) / 255 * 1.6, 0, 1)

            background_fade = edge_fade(width, height, FADE_TOP, FADE_BOTTOM, FADE_SIDE, FADE_SIDE)
            edge_soften = edge_fade(width, height, EDGE_SOFTEN, EDGE_SOFTEN, EDGE_SOFTEN, EDGE_SOFTEN)
            alpha = np.minimum(edge_soften, np.maximum(keep, background_fade))

            rgba = np.zeros((height, width, 4), 'uint8')
            rgba[..., 3] = np.round(alpha * 255).astype('uint8')
            out = OUT_DIR / f'{stage}.png'
            Image.fromarray(rgba).save(out, optimize=True)

            # 自检：逐帧统计"角色像素"落在明显渐隐区（不透明度 < 90%）的比例。
            # 画面最外圈 EDGE_SOFTEN 的柔化带是有意为之，不计入。
            inner = edge_soften >= 0.999
            worst = 0.0
            for frame in frames:
                cm = character_mask(Image.open(frame)) & inner
                total = cm.sum()
                if total:
                    worst = max(worst, ((alpha < 0.9) & cm).sum() / total)
            print(f'{stage:6s} 视频 {src_w}x{src_h}  {len(frames):4d} 帧  '
                  f'{out.stat().st_size / 1024:5.1f} KB  角色落在渐隐区：最多 {worst:.1%}')


if __name__ == '__main__':
    main()
