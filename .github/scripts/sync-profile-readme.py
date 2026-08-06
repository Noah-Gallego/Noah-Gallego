#!/usr/bin/env python3
import json, re, urllib.request
from pathlib import Path

URL = 'https://www.noahgallego.com/api/profile-sync'
BADGES = {
  'Python':('3776AB','python','white'),'TypeScript':('3178C6','typescript','white'),'JavaScript':('F7DF1E','javascript','black'),'C++':('00599C','cplusplus','white'),'C':('A8B9CC','c','black'),'Rust':('000000','rust','white'),'Java':('ED8B00','openjdk','white'),'Ruby':('CC342D','ruby','white'),'PHP':('777BB4','php','white'),'Ada':('02f88c','ada','black'),'HTML':('E34F26','html5','white'),'CSS':('1572B6','css3','white'),'Sass':('CC6699','sass','white'),'SQL':('4479A1','mysql','white'),
  'PyTorch':('EE4C2C','pytorch','white'),'TensorFlow':('FF6F00','tensorflow','white'),'scikit-learn':('F7931E','scikit--learn','white'),'NumPy':('013243','numpy','white'),'Pandas':('150458','pandas','white'),'Jupyter':('F37626','jupyter','white'),'Keras':('D00000','keras','white'),'Matplotlib':('11557C','matplotlib','white'),
  'AWS':('232F3E','amazonwebservices','white'),'Azure':('0078D4','microsoftazure','white'),'Vercel':('000000','vercel','white'),'Node.js':('339933','nodedotjs','white'),'MySQL':('4479A1','mysql','white'),'SQL Server':('CC2927','microsoftsqlserver','white'),'Docker':('2496ED','docker','white'),'Kubernetes':('326CE5','kubernetes','white'),'Terraform':('844FBA','terraform','white'),'Git':('F05032','git','white'),'GitHub':('181717','github','white'),'Linux':('FCC624','linux','black'),'FastAPI':('009688','fastapi','white'),'Spring Boot':('6DB33F','springboot','white'),'React':('61DAFB','react','black'),'Jenkins':('D24939','jenkins','white'),'Claude':('D97757','anthropic','white')}

def badge(name):
  color, logo, fg = BADGES.get(name, ('555555','', 'white'))
  return f'<img src="https://img.shields.io/badge/{name.replace(" ", "%20")}-{color}?style=for-the-badge&logo={logo}&logoColor={fg}" alt="{name}"/>'

def replace(text, key, body):
  pattern = rf'<!-- profile-sync:{key}:start -->.*?<!-- profile-sync:{key}:end -->'
  out, count = re.subn(pattern, f'<!-- profile-sync:{key}:start -->\n{body}\n<!-- profile-sync:{key}:end -->', text, flags=re.S)
  if count != 1: raise RuntimeError(f'marker {key}: expected 1, got {count}')
  return out

def main():
  data = json.load(urllib.request.urlopen(URL, timeout=20))
  readme = Path('README.md').read_text()
  titles = {'languages':'### Languages','mlData':'### ML & Data','tools':'### Infra & Tools'}
  for key in titles:
    body = titles[key] + '\n\n<p>\n' + '\n'.join('  ' + badge(x) for x in data['groups'][key]) + '\n</p>'
    readme = replace(readme, key, body)
  rows = '\n'.join(f"- **{x['role']}** — {x['organization']} · {x['dates']} · {x['location']}" for x in data['experience'])
  readme = replace(readme, 'experience', '### Experience\n\n' + rows)
  Path('README.md').write_text(readme)

if __name__ == '__main__': main()
