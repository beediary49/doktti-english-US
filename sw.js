const CACHE='doktti-shell-v20';
const SHELL=['./','./index.html','./app.js','./lessons.json','./manifest.webmanifest','./version.json','./icon-192.png','./icon-512.png','./icon-maskable-192.png','./icon-maskable-512.png','./icon-original.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(key=>key.startsWith('doktti-shell-')&&key!==CACHE).map(key=>caches.delete(key)));
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET'||request.destination==='video'||request.headers.has('range'))return;
 const url=new URL(request.url);if(url.origin!==location.origin||!url.pathname.startsWith(new URL('./',self.registration.scope).pathname))return;
 const path=url.pathname,asset=SHELL.some(x=>path.endsWith(x.replace('./','')));
 if(request.mode==='navigate'||/\.(?:js|json|webmanifest|html)$/.test(path)){
  event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
   if(response.ok&&asset){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)))}
   return response;
  }).catch(()=>caches.match(request,{ignoreSearch:true}).then(r=>r||(request.mode==='navigate'?caches.match('./index.html'):undefined))));return;
 }
 event.respondWith(caches.match(request,{ignoreSearch:true}).then(hit=>hit||fetch(request).then(response=>{
  if(response.ok&&asset){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)))}return response;
 })));
});
