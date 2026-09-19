from pathlib import Path
import struct
import json

root = Path(__file__).resolve().parents[1]
video = root / 'renders' / 'storefront_tour.mp4'
if not video.exists():
    candidates = list((root / 'renders').glob('storefront_tour*.mp4'))
    assert len(candidates) == 1, candidates
    candidates[0].rename(video)
data = video.read_bytes()
def atoms(start, end):
    while start + 8 <= end:
        size, kind = struct.unpack_from('>I4s', data, start)
        header = 8
        if size == 1:
            size = struct.unpack_from('>Q', data, start + 8)[0]
            header = 16
        elif size == 0:
            size = end - start
        assert size >= header
        yield kind, start + header, start + size
        start += size
video_report = {'bytes': len(data)}
def inspect(start, end):
    for kind, pos, stop in atoms(start, end):
        if kind in (b'moov', b'trak', b'mdia', b'minf', b'stbl'):
            inspect(pos, stop)
        elif kind == b'mvhd':
            if data[pos] == 0:
                timescale, duration = struct.unpack_from('>II', data, pos + 12)
            else:
                timescale = struct.unpack_from('>I', data, pos + 20)[0]
                duration = struct.unpack_from('>Q', data, pos + 24)[0]
            video_report['duration_seconds'] = duration / timescale
        elif kind == b'tkhd':
            width, height = struct.unpack_from('>II', data, stop - 8)
            if width and height:
                video_report['width'] = width // 65536
                video_report['height'] = height // 65536
        elif kind == b'stsz':
            video_report['encoded_frames'] = struct.unpack_from('>I', data, pos + 8)[0]
inspect(0, len(data))
assert video_report['width'] == 1600 and video_report['height'] == 1200, video_report
assert abs(video_report['duration_seconds'] - 32) < 0.01, video_report
assert video_report['encoded_frames'] == 768, video_report
report = json.loads((root / 'renders' / 'validation.json').read_text())
report['video'] = video_report
(root / 'renders' / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
