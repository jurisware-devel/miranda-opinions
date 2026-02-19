#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root='/Users/jonathan/Projects/miranda-opinions';
const years=new Set(['2014','2015']);

function walk(dir,out=[]){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p,out);else if(ent.isFile()&&p.endsWith('.md'))out.push(p);}return out;}
const files=walk(path.join(root,'coa')).filter(f=>years.has(path.basename(path.dirname(f)))).sort();

let filesChanged=0, fixes=0;
for(const file of files){
  let t=fs.readFileSync(file,'utf8');
  const original=t;

  // Case 1: [#][People v ..., XXX NY3d YYY, ZZZ [year])<extra>](https://miranda...)
  t=t.replace(/\[(\d+)\]\[(People\s+v\.?\s+[A-Z][A-Za-z'\- ]+?,\s*\d+\s+NY3d\s+\d+,\s*\d+\s*\[\d{4}\])([^\]]*)\]\((https:\/\/miranda\.jurisware\.com\/case\/\d{4}_\d{5}\/?)\)/g,
    (_m,_n,cite,extra,url)=>{fixes++;return `[${cite}](${url})${extra}`;});

  // Case 2: [#][People v ..., XXX NY3d YYY, ZZZ [year]](https://miranda...)
  t=t.replace(/\[(\d+)\]\[(People\s+v\.?\s+[A-Z][A-Za-z'\- ]+?,\s*\d+\s+NY3d\s+\d+,\s*\d+\s*\[\d{4}\])\]\((https:\/\/miranda\.jurisware\.com\/case\/\d{4}_\d{5}\/?)\)/g,
    (_m,_n,cite,url)=>{fixes++;return `[${cite}](${url})`;});

  if(t!==original){
    fs.writeFileSync(file,t,'utf8');
    filesChanged++;
  }
}

console.log(JSON.stringify({files_scanned:files.length,files_changed:filesChanged,fixes},null,2));
