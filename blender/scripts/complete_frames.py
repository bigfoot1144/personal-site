"""Reuse identical stationary camera poses and verify the complete delivery."""
from pathlib import Path
import shutil
import struct
import json

root = Path(__file__).resolve().parents[1]
frames = root / 'renders' / 'frames'
reused = 0
for frame in range(1, 769):
    segment = min(3, (frame - 1) // 192)
    phase = (frame - 1) % 192
    source = frame
    if phase <= 24 or frame == 768:
        source = 1
    elif phase <= 95:
        pass
    elif phase <= 144:
        source = segment * 192 + 97
    elif (phase - 144) % 2 == 0:
        source = segment * 192 + 25 + (48 - (phase - 144)) * 3 // 2
    src = frames / f'tour_{source:04d}.png'
    dst = frames / f'tour_{frame:04d}.png'
    if source != frame:
        shutil.copyfile(src, dst)
        reused += 1
    with dst.open('rb') as handle:
        header = handle.read(24)
    assert header[:8] == b'\x89PNG\r\n\x1a\n', dst
    assert struct.unpack('>II', header[16:24]) == (1600, 1200), dst

report = {'frames': 768, 'width': 1600, 'height': 1200, 'fps': 24, 'duration_seconds': 32, 'identical_camera_poses_reused': reused, 'total_frame_bytes': sum(p.stat().st_size for p in frames.glob('tour_*.png'))}
(root / 'renders' / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
