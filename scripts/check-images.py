#!/usr/bin/env python3
"""Decode selected artwork assets before publication. Requires Pillow; never fabricates replacements."""
import argparse,concurrent.futures,hashlib,io,json,pathlib,urllib.request
from PIL import Image,ImageStat
p=argparse.ArgumentParser();p.add_argument('data');p.add_argument('--date');p.add_argument('--base');p.add_argument('--root',default='.');args=p.parse_args()
d=json.loads(pathlib.Path(args.data).read_text());items=[x for i in d['issues'] if not args.date or i['date']==args.date for x in i['items']]
def check(x):
 out={'id':x['id'],'image':x.get('image'),'fails':[],'warns':[]}
 if not x.get('image'):out['warns'].append('missing artwork image (legacy item)');return out
 try:
  if args.base:
   with urllib.request.urlopen(args.base.rstrip('/')+'/'+x['image'],timeout=15) as r:
    out['httpStatus']=r.status;b=r.read(10_000_001)
  else:b=(pathlib.Path(args.root)/x['image']).read_bytes()
  if len(b)>10_000_000:raise ValueError('image exceeds 10 MB')
  im=Image.open(io.BytesIO(b));im.load();out.update(width=im.width,height=im.height,format=im.format,bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
  stat=ImageStat.Stat(im.convert('RGB').resize((64,64)))
  if max(stat.mean)<1 and max(stat.stddev)<1:out['fails'].append('empty or all-black image: inspect source')
  if max(im.size)<600:out['warns'].append('long edge below 600px')
 except Exception as e:out['fails'].append(str(e))
 return out
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:r=list(ex.map(check,items))
result={'ok':not any(x['fails'] for x in r),'checked':len(r),'results':r};print(json.dumps(result,ensure_ascii=False,indent=2))
raise SystemExit(0 if result['ok'] else 1)
