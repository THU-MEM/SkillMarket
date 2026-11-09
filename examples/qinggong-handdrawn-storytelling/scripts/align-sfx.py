#!/usr/bin/env python3
"""Place an explicit PCM-WAV transient's sample peak on a visual cue.
No resynthesis or gain change; printed JSON is a suggested timeline placement.
"""
import argparse,json,math,wave
from pathlib import Path

def placement(peak_offset,visual_time):
    if not all(math.isfinite(v) and v>=0 for v in (peak_offset,visual_time)):
        raise ValueError('Times must be finite and nonnegative')
    return {'peakOffset':peak_offset,'visualTime':visual_time,
            'start':max(0.,visual_time-peak_offset),
            'mediaStart':max(0.,peak_offset-visual_time),
            'trimmedAttack':peak_offset>visual_time}

def align(path,visual_time):
    with wave.open(str(path),'rb') as w:
        width,channels,rate,frames=w.getsampwidth(),w.getnchannels(),w.getframerate(),w.getnframes()
        if w.getcomptype()!='NONE' or width not in (2,3,4) or not 1<=channels<=2:
            raise ValueError('Use signed PCM 16/24/32-bit mono or stereo WAV')
        if not 0<frames/rate<=30:
            raise ValueError('SFX must be nonempty and at most 30 seconds')
        data=w.readframes(frames)
    if len(data)!=frames*channels*width:raise ValueError('Truncated PCM')
    best,at=0,0
    for i in range(frames):
        off=i*channels*width
        peak=max(abs(int.from_bytes(data[off+c*width:off+(c+1)*width],'little',signed=True)) for c in range(channels))
        if peak>best:best,at=peak,i
    if not best:raise ValueError('Silent SFX has no event peak')
    return {**placement(at/rate,visual_time),'file':Path(path).name,'duration':frames/rate,'sampleRate':rate,'peakMethod':'absolute sample peak; listening can require a perceptual adjustment'}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('wav',type=Path);p.add_argument('--event',type=float,required=True);args=p.parse_args()
    print(json.dumps(align(args.wav,args.event),ensure_ascii=False,indent=2))
