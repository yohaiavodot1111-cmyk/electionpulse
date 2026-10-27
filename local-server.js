// Development server only. Production on Vercel uses the api/*.js handlers.
import http from 'node:http';import {readFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import path from 'node:path';
const base=path.dirname(fileURLToPath(import.meta.url));
const handlers={history:await import('./api/history.js'),state:await import('./api/state.js'),media:await import('./api/media.js')};
const port=Number(process.env.PORT)||8787;
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');
  const route=/^\/api\/(history|state|media)$/.exec(u.pathname);
  if(route){const opts=Object.fromEntries(u.searchParams);req.query=opts;res.status=(status)=>{res.statusCode=status;return res};res.json=(x)=>res.end(JSON.stringify(x));return await handlers[route[1]].default(req,res)}
  if(u.pathname!=='/'&&u.pathname!=='/index.html')return res.writeHead(404).end('Not found');
  const html=await readFile(path.join(base,'index.html'));
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(html);
 }catch(e){res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'}).end('Internal error');console.error(e)}
});server.listen(port,()=>console.log('ElectionPulse running: http://localhost:'+port));
