#!/usr/bin/env python3
"""Sync README badge blocks from the portfolio's profile-sync API.

Only text between a `<!-- profile-sync:<key>:start -->` marker and its matching
`:end` marker is rewritten. Everything else -- banner, About table, photo, the
committed card images and the footer -- is left byte-for-byte untouched.

The three badge blocks are required: if one is missing, or the API returns no
entries for it, the run fails loudly rather than silently emptying a section.
The `experience` block is optional; the README intentionally has no Experience
section today, so its absence is not an error.
"""
import json, re, urllib.request
from pathlib import Path

URL = 'https://www.noahgallego.com/api/profile-sync/'
TITLES = {'languages':'### Languages','mlData':'### ML & Data','tools':'### Infra & Tools'}
BADGES = {
  'Python':('3776AB','python','white'),'TypeScript':('3178C6','typescript','white'),'JavaScript':('F7DF1E','javascript','black'),'C++':('00599C','cplusplus','white'),'C':('A8B9CC','c','black'),'Rust':('000000','rust','white'),'Java':('ED8B00','openjdk','white'),'Ruby':('CC342D','ruby','white'),'PHP':('777BB4','php','white'),'Ada':('02f88c','ada','black'),'HTML':('E34F26','html5','white'),'CSS':('1572B6','css3','white'),'Sass':('CC6699','sass','white'),'SQL':('4479A1','mysql','white'),
  'PyTorch':('EE4C2C','pytorch','white'),'TensorFlow':('FF6F00','tensorflow','white'),'scikit-learn':('F7931E','scikit--learn','white'),'NumPy':('013243','numpy','white'),'Pandas':('150458','pandas','white'),'Jupyter':('F37626','jupyter','white'),'Keras':('D00000','keras','white'),'Matplotlib':('11557C','matplotlib','white'),
  'AWS':('232F3E','amazonwebservices','white'),'Azure':('0078D4','microsoftazure','white'),'Vercel':('000000','vercel','white'),'Node.js':('339933','nodedotjs','white'),'MySQL':('4479A1','mysql','white'),'SQL Server':('CC2927','microsoftsqlserver','white'),'Docker':('2496ED','docker','white'),'Kubernetes':('326CE5','kubernetes','white'),'Terraform':('844FBA','terraform','white'),'Git':('F05032','git','white'),'GitHub':('181717','github','white'),'Linux':('FCC624','linux','black'),'FastAPI':('009688','fastapi','white'),'Spring Boot':('6DB33F','springboot','white'),'React':('61DAFB','react','black'),'Jenkins':('D24939','jenkins','white'),'Claude':('D97757','anthropic','white')}

def badge(name):
  color, logo, fg = BADGES.get(name, ('555555','', 'white'))
  return f'<img src="https://img.shields.io/badge/{name.replace(" ", "%20")}-{color}?style=for-the-badge&logo={logo}&logoColor={fg}" alt="{name}"/>'

def replace(text, key, body, required=True):
  """Rewrite one marker block; optional blocks are skipped when absent."""
  pattern = rf'<!-- profile-sync:{re.escape(key)}:start -->.*?<!-- profile-sync:{re.escape(key)}:end -->'
  block = f'<!-- profile-sync:{key}:start -->\n{body}\n<!-- profile-sync:{key}:end -->'
  # lambda replacement: body is API data and must never be read as a re template
  out, count = re.subn(pattern, lambda _match: block, text, flags=re.S)
  if count == 1: return out
  if count == 0 and not required: return text
  raise RuntimeError(f'marker {key}: expected 1 block, found {count}')

def main():
  data = json.load(urllib.request.urlopen(URL, timeout=20))
  readme = Path('README.md').read_text()
  groups = data.get('groups') or {}
  for key, title in TITLES.items():
    items = groups.get(key) or []
    if not items: raise RuntimeError(f'profile-sync returned no entries for group {key}')
    readme = replace(readme, key, title + '\n\n<p>\n' + '\n'.join('  ' + badge(x) for x in items) + '\n</p>')
  experience = data.get('experience') or []
  if experience:
    rows = '\n'.join(f"- **{x['role']}** — {x['organization']} · {x['dates']} · {x['location']}" for x in experience)
    readme = replace(readme, 'experience', '### Experience\n\n' + rows, required=False)
  Path('README.md').write_text(readme)

if __name__ == '__main__': main()
