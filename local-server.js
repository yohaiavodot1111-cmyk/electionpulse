// Zero-dependency local preview. Run: npm run dev
import http from 'node:http';
import fs from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import handler from './api/state.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||3000);
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/state'){
   res.status=(code)=>{res.statusCode=code;return res};
   res.json=(payload)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(payload));return res};
   return handler(req,res);
 }
 if(url.pathname!=='/'&&url.pathname!=='/index.html'){res.writeHead(404);res.end('Not found');return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile(path.join(root,'index.html')));
}).listen(port,()=>console.log(`ElectionPulse → http://localhost:${port}`));
