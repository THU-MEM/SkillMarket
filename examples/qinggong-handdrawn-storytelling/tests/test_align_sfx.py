import importlib.util,unittest,tempfile,wave,struct
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'scripts/align-sfx.py'
spec=importlib.util.spec_from_file_location('align_sfx',P)
assert spec and spec.loader
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class AlignTests(unittest.TestCase):
 def test_peak_aligned_not_file_start(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'click.wav'
   with wave.open(str(p),'wb') as w:w.setparams((1,2,1000,0,'NONE','not compressed'));w.writeframes(b''.join(struct.pack('<h',20000 if i==125 else 0) for i in range(250)))
   r=m.align(p,2);self.assertEqual(r['peakOffset'],.125);self.assertEqual(r['start'],1.875);self.assertEqual(r['mediaStart'],0)
 def test_start_boundary(self):
  r=m.placement(.2,.1);self.assertAlmostEqual(r['mediaStart'],.1);self.assertEqual(r['start'],0)
 def test_reject_nan_and_negative(self):
  for v in [float('nan'),float('inf'),-1]:
   with self.assertRaises(ValueError):m.placement(.1,v)
 def test_silence_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'silence.wav'
   with wave.open(str(p),'wb') as w:w.setparams((2,3,1000,0,'NONE','not compressed'));w.writeframes(bytes(1200))
   with self.assertRaises(ValueError):m.align(p,1)
if __name__=='__main__':unittest.main()
