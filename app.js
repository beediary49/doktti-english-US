'use strict';
const $=id=>document.getElementById(id);
const video=$('video');
let lessons=[],lesson=null,index=0,playingSegment=false,repeat=false,search='',deferredPrompt=null,videoUrl=null,dbPromise=null,favoritesOnly=false,memoContextIndex=null;
const cacheKey='doktti-state-v3'; // v7: keep existing storage
let state={};try{state=JSON.parse(localStorage.getItem(cacheKey)||'{}')}catch{}
state.favorites??={};state.memos??={};state.done??={};state.manualDone??={};state.lesson??='';state.index??=0;state.autoscroll??=true;state.speed??=1;
const save=()=>{state.lesson=lesson?.id||'';state.index=index;state.speed=Number($('speed').value);state.autoscroll=true;localStorage.setItem(cacheKey,JSON.stringify(state))};
const stamp=n=>{n=Math.floor(n||0);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`};
const line=()=>lesson?.lines[index];
function segmentEnd(){const s=line();return s?Math.max(s.start+.5,Math.min(s.end,lesson.lines[index+1]?.start??s.end)):0}
function renderTabs(){const nav=$('partTabs');nav.replaceChildren();for(const l of lessons){const btn=document.createElement('button');btn.className='part'+(l.id===lesson?.id?' active':'');btn.textContent=l.title;btn.addEventListener('click',()=>selectLesson(l.id));nav.append(btn)}nav.querySelector('.active')?.scrollIntoView({block:'nearest',inline:'nearest'});}
function renderList(){const panel=$('sentences');panel.replaceChildren();const lines=lesson?.lines||[];const needle=search.trim().toLowerCase();let shown=0;lines.forEach((s,i)=>{if(needle&&!s.text.toLowerCase().includes(needle))return;if(favoritesOnly&&!state.favorites[lesson.id]?.[i])return;shown++;const row=document.createElement('div');row.className='sentence'+(i===index?' active':'');row.dataset.i=i;const body=document.createElement('div');body.className='sentence-body';body.tabIndex=0;body.setAttribute('role','button');body.setAttribute('aria-label',s.text+' 재생');const main=document.createElement('div');main.className='sentence-main';main.textContent=s.text;const tim=document.createElement('div');tim.className='sentence-time';tim.textContent=`${stamp(s.start)} – ${stamp(s.end)}`;if(state.manualDone[lesson.id]?.[i]){const done=document.createElement('span');done.className='doneLabel';done.textContent=' · ✓ 학습 완료';tim.append(done)}if(state.memos[lesson.id+'@'+i]){const memo=document.createElement('span');memo.className='memo-note';memo.textContent='✎';tim.append(memo)};body.append(main,tim);body.addEventListener('click',()=>playIndex(i));body.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();playIndex(i)}});const star=document.createElement('button');star.className='smallbtn'+(state.favorites[lesson.id]?.[i]?' starred':'');star.textContent=state.favorites[lesson.id]?.[i]?'★':'☆';star.setAttribute('aria-label','즐겨찾기');star.addEventListener('click',()=>{state.favorites[lesson.id]??={};if(state.favorites[lesson.id][i])delete state.favorites[lesson.id][i];else state.favorites[lesson.id][i]=true;save();renderList()});const memoIcon=document.createElement('button');memoIcon.className='smallbtn memo-launch';memoIcon.textContent='✎';memoIcon.style.fontSize='14px';memoIcon.setAttribute('aria-label','이 문장 메모');memoIcon.addEventListener('click',()=>openMemo(i));const doneButton=document.createElement('button');doneButton.className='smallbtn complete-toggle'+(state.manualDone[lesson.id]?.[i]?' completed':'');doneButton.textContent=state.manualDone[lesson.id]?.[i]?'✓':'○';doneButton.setAttribute('aria-label',state.manualDone[lesson.id]?.[i]?'학습 완료 해제':'학습 완료 표시');doneButton.setAttribute('aria-pressed',state.manualDone[lesson.id]?.[i]?'true':'false');doneButton.title=state.manualDone[lesson.id]?.[i]?'학습 완료됨 (눌러 해제)':'학습 완료 (눌러 체크)';doneButton.addEventListener('click',()=>{state.manualDone[lesson.id]??={};if(state.manualDone[lesson.id][i])delete state.manualDone[lesson.id][i];else state.manualDone[lesson.id][i]=true;save();renderList()});row.append(body,star,memoIcon,doneButton);panel.append(row)});if(!shown){const p=document.createElement('p');p.className='help';p.textContent=favoritesOnly?'즐겨찾기한 문장이 없습니다.':'일치하는 문장이 없습니다.';panel.append(p)}updateStatus()}
function updateStatus(){if(!lesson)return;const total=lesson.lines.length;$('status').textContent=`마지막 학습 위치 · ${lesson.title} · ${stamp(line()?.start||0)}`;$('countLabel').textContent=`● ${total}개 표현`;$('videoLessonTitle').textContent=lesson.title;}
function setActive(){document.querySelectorAll('.sentence').forEach(b=>{const i=+b.dataset.i;b.classList.toggle('active',i===index);void 0});document.querySelector(`.sentence[data-i="${index}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest'});updateStatus()}
function playIndex(i,play=true){if(!lesson?.lines.length)return;if(!video.src||!video.currentSrc){showFileStatus('영상 미등록 · 상단 영상 선택 버튼으로 등록하세요.');return}index=Math.max(0,Math.min(i,lesson.lines.length-1));playingSegment=play;try{video.currentTime=Math.max(0,line().start)}catch{}setActive();save();if(play)video.play().catch(()=>{playingSegment=false})}
function next(){if(!lesson)return;if(index+1<lesson.lines.length){playIndex(index+1);return}const at=lessons.findIndex(x=>x.id===lesson.id);if(at+1<lessons.length){selectLesson(lessons[at+1].id,true);return}video.pause();playingSegment=false;setActive()}
function tick(){if(playingSegment&&line()&&video.readyState>0&&video.currentTime>=segmentEnd()-.055){if(!repeat){next()}else if(repeat){video.currentTime=line().start;video.play().catch(()=>{})}else{video.pause();playingSegment=false;setActive()}}requestAnimationFrame(tick)}
function openDB(){if(!('indexedDB' in window))return Promise.reject(Error('이 브라우저에서 기기 저장을 지원하지 않습니다.'));if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('doktti-videos-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('videos');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});return dbPromise}
async function dbGet(key){const db=await openDB();return new Promise((resolve,reject)=>{const req=db.transaction('videos','readonly').objectStore('videos').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function dbPut(key,file){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('videos','readwrite');tx.objectStore('videos').put(file,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
function showFileStatus(message){$('fileStatus').textContent=message;$('mobileFileStatus').textContent=message;$('desktopVideoInfo').textContent=message}
async function loadVideo(id){if(videoUrl){URL.revokeObjectURL(videoUrl);videoUrl=null}video.removeAttribute('src');video.load();showFileStatus('기기에 보관된 영상 확인 중…');try{const file=await dbGet(id);if(!lesson||lesson.id!==id)return;if(file){videoUrl=URL.createObjectURL(file);video.src=videoUrl;video.load();video.playbackRate=Number($('speed').value);showFileStatus(`✓ 기기에 보관된 영상 연결: ${file.name||'영상 파일'} (앱에서 다운로드하지 않음)`)}else{showFileStatus('영상 미등록 · 아래 버튼으로 기기에 있는 MP4를 한 번 등록하세요.')}}catch(e){showFileStatus('기기 저장소를 사용할 수 없습니다: '+e.message)}}
async function selectLesson(id,auto=false){const l=lessons.find(x=>x.id===id)||lessons[0];if(!l)return;video.pause();playingSegment=false;lesson=l;index=auto?0:(state.lesson===id?Math.max(0,Math.min(state.index,l.lines.length-1)):0);$('lessonTitle').textContent='영어 표현';renderTabs();$('warning').textContent=l.warning||'자막은 원본 SRT를 기반으로 하며 일부 문장 인식·분리 오류가 있을 수 있습니다.';$('warning').className='note'+(l.warning?' warning':'');search='';$('search').value='';renderList();save();await loadVideo(l.id);if(auto&&video.src)video.addEventListener('loadedmetadata',()=>playIndex(0),{once:true})}
function durationOf(file){return new Promise((resolve,reject)=>{const element=document.createElement('video');element.preload='metadata';const url=URL.createObjectURL(file);const finish=(error,duration)=>{element.removeAttribute('src');element.load();URL.revokeObjectURL(url);error?reject(error):resolve(duration)};element.onloadedmetadata=()=>finish(null,element.duration);element.onerror=()=>finish(Error('영상 재생 정보를 읽을 수 없습니다.'));element.src=url})}
async function importFiles(files,justCurrent=false){if(!files.length)return;let count=0,unknown=[],fail=[];const used=new Set();$('registerBtn').disabled=true;$('registerAllBtn').disabled=true;try{for(let n=0;n<files.length;n++){const f=files[n];showFileStatus(`영상 연결 중 ${n+1}/${files.length}: ${f.name}`);try{const duration=await durationOf(f);let target=null;if(justCurrent)target=lesson;else{
// 영상의 실제 재생시간을 사용해 원본 27개 중 일치하는 구간을 자동 탐색합니다.
const matches=lessons.filter(x=>!used.has(x.id)).map(x=>({lesson:x,diff:Math.abs(x.duration-duration)})).sort((a,b)=>a.diff-b.diff);
if(matches.length&&matches[0].diff<2.5&&(matches.length===1||matches[1].diff-matches[0].diff>.35))target=matches[0].lesson;
// 파일명이 원본 그대로라면 이름도 검증용으로 사용합니다.
if(!target){const byName=lessons.find(x=>!used.has(x.id)&&x.video?.split('/').pop().toLowerCase()===f.name.toLowerCase());if(byName&&Math.abs(byName.duration-duration)<5)target=byName}
}
if(!target){unknown.push(f.name);continue}await dbPut(target.id,f);used.add(target.id);count++}catch(e){fail.push(`${f.name}: ${e.message||e}`)}}await loadVideo(lesson.id);let msg=`등록 완료: ${count}개 영상`;if(unknown.length)msg+=` · 자동 매칭 실패 ${unknown.length}개 (해당 일차에서 '현재 일차 영상 등록'으로 직접 연결하세요)`;if(fail.length)msg+=` · 저장 실패 ${fail.length}개 (저장 공간 확인)`;showFileStatus(msg);if(fail.length||unknown.length)alert(msg)}finally{$('registerBtn').disabled=false;$('registerAllBtn').disabled=false}}
async function start(){try{const response=await fetch('lessons.json',{cache:'no-store'});if(!response.ok)throw Error('파일 로딩 실패');lessons=await response.json();for(const l of lessons){const o=document.createElement('option');o.value=l.id;o.textContent=l.title;/* tabs rendered by selectLesson */}$('speed').value=String(state.speed);await selectLesson(state.lesson);video.playbackRate=Number(state.speed)}catch(e){$('sentences').textContent='앱 데이터를 불러오지 못했습니다. GitHub Pages 또는 로컬 웹 서버에서 실행해 주세요.';$('status').textContent=String(e)}requestAnimationFrame(tick)}
$('prev').addEventListener('click',()=>playIndex(index-1));$('next').addEventListener('click',next);$('repeat').addEventListener('click',()=>{repeat=!repeat;$('repeat').textContent=repeat?'↻ 구간 반복: ON':'↻ 구간 반복: OFF';$('repeat').classList.toggle('on',repeat)});$('speed').addEventListener('change',()=>{video.playbackRate=+$('speed').value;save()});$('search').addEventListener('input',e=>{search=e.target.value;renderList()});$('favoritesOnly').addEventListener('click',()=>{favoritesOnly=!favoritesOnly;$('favoritesOnly').classList.toggle('on',favoritesOnly);$('favoritesOnly').textContent=favoritesOnly?'★ 즐겨찾기만':'☆ 즐겨찾기';renderList()});video.addEventListener('seeking',()=>{if(!lesson)return;const sec=video.currentTime;const found=lesson.lines.findIndex((s,i)=>sec>=s.start&&sec<(lesson.lines[i+1]?.start??s.end));if(found>=0&&found!==index){index=found;setActive();save()}});video.addEventListener('play',()=>{if(!playingSegment&&line())playingSegment=true});video.addEventListener('ended',()=>{playingSegment=false;updateStatus()});
function openMemo(targetIndex=index){if(!lesson)return;memoContextIndex=Math.max(0,Math.min(targetIndex,lesson.lines.length-1));const cue=lesson.lines[memoContextIndex];const key=lesson.id+'@'+memoContextIndex;$('memoContext').textContent=`${lesson.title} · ${cue?.text||''} (${stamp(cue?.start||0)} – ${stamp(cue?.end||0)})`;$('memoText').value=state.memos[key]??state.memos[lesson.id]??'';$('memoModal').hidden=false;positionNote();freezePlayerForMemo();}
function saveMemo(close=false){if(!lesson||memoContextIndex===null)return;state.memos[lesson.id+'@'+memoContextIndex]=$('memoText').value;save();if(close){$('memoModal').hidden=true;unfreezePlayerForMemo()}renderList()}
$('memoSave').addEventListener('click',()=>saveMemo(true));
// v17: keep the lesson/video frame fixed, even when Samsung keyboard is shown.
// The floating memo is movable only vertically. A short downward swipe while
// keyboard is present may move it all the way behind the keyboard boundary.
const notePanel=$('notePanel');
const noteHandle=$('noteDrag');
const memoField=$('memoText');
const memoViewport=()=>window.visualViewport;
// Preserve the measured video rectangle before an Android keyboard or memo
// may alter dynamic viewport / short-screen media queries.
let memoPlayerHeight=0;
function freezePlayerForMemo(){
 const root=document.documentElement;
 const shell=document.querySelector('.app');
 const player=document.querySelector('.video-wrap');
 const vv=window.visualViewport;
 const shellHeight=Math.round(shell.getBoundingClientRect().height || window.innerHeight);
 memoPlayerHeight=Math.round(player.getBoundingClientRect().height);
 root.style.setProperty('--doktti-memo-shell-height',shellHeight+'px');
 root.style.setProperty('--doktti-memo-player-height',memoPlayerHeight+'px');
 root.classList.add('memo-player-fixed');
 // Scrolling of the overall document is forbidden; only the cue list scrolls.
 if(window.scrollX||window.scrollY)window.scrollTo(0,0);
}
function unfreezePlayerForMemo(){
 const root=document.documentElement;
 root.classList.remove('memo-player-fixed');
 root.style.removeProperty('--doktti-memo-shell-height');
 root.style.removeProperty('--doktti-memo-player-height');
 memoPlayerHeight=0;
}

let dragStart=null;
let memoKeyboardActive=false;
let memoPreKeyboardTop=null;
let memoDraggedDuringKeyboard=false;
let noteFullHeight=Math.max(window.innerHeight,document.documentElement.clientHeight);
let lockedOrientation=screen.orientation?.type||'';
function isMemoKeyboardOpen(){
 const vv=memoViewport();
 if(!vv||document.activeElement!==memoField)return false;
 return noteFullHeight-(vv.height+Math.max(0,vv.offsetTop))>110;
}
function lockAppHeight(){
 // A keyboard resize must not collapse the 16:9 video or move the app itself.
 if(isMemoKeyboardOpen() || document.documentElement.classList.contains('memo-player-fixed'))return;
 // If the keyboard is still animating away, postpone the size update.
 if(memoKeyboardActive)return;
 const next=Math.max(window.innerHeight,document.documentElement.clientHeight);
 if(next>0){noteFullHeight=next;document.documentElement.style.setProperty('--doktti-locked-height',next+'px')}
}
document.documentElement.style.setProperty('--doktti-locked-height',noteFullHeight+'px');
function positionNote(){
 dragStart=null;
 notePanel.style.top='';notePanel.style.bottom='';
 notePanel.style.left='';notePanel.style.right='';
 memoKeyboardActive=false;memoPreKeyboardTop=null;memoDraggedDuringKeyboard=false;
}
function memoAllowedY(y){
 const vv=memoViewport();
 const keyboard=isMemoKeyboardOpen();
 const top=Math.max(6,vv?.offsetTop||0);
 // The maximum position is based on the FULL screen, not visualViewport.height.
 // This deliberately allows the memo to be behind the Android IME.
 const bottom=keyboard?Math.max(top,noteFullHeight-12):Math.max(top,(vv?.offsetTop||0)+(vv?.height||noteFullHeight)-notePanel.offsetHeight-6);
 return Math.max(top,Math.min(bottom,y));
}
noteHandle.addEventListener('pointerdown',e=>{
 if(e.button!==undefined&&e.button!==0)return;
 e.preventDefault(); // Preserve textarea focus and keep the keyboard open.
 dragStart={pointerId:e.pointerId,fromY:e.clientY,top:notePanel.getBoundingClientRect().top};
 noteHandle.setPointerCapture(e.pointerId);
});
noteHandle.addEventListener('pointermove',e=>{
 if(!dragStart||e.pointerId!==dragStart.pointerId)return;
 e.preventDefault();
 const dy=e.clientY-dragStart.fromY;
 // Since fingers cannot drag inside the physical keyboard, amplify only the
 // downward movement with keyboard open so the panel can cross its top edge.
 const scaled=isMemoKeyboardOpen()&&dy>0?dy*2.8:dy;
 const y=memoAllowedY(dragStart.top+scaled);
 notePanel.style.top=y+'px';notePanel.style.bottom='auto';
 // Never move the memo horizontally; left/right remain at their CSS positions.
 if(isMemoKeyboardOpen())memoDraggedDuringKeyboard=true;
});
function finishNoteDrag(e){
 if(!dragStart||e.pointerId!==dragStart.pointerId)return;
 dragStart=null;
 if(noteHandle.hasPointerCapture?.(e.pointerId))noteHandle.releasePointerCapture(e.pointerId);
}
noteHandle.addEventListener('pointerup',finishNoteDrag);
noteHandle.addEventListener('pointercancel',finishNoteDrag);
function watchMemoViewport(){
 if($('memoModal').hidden)return;
 const keyboard=isMemoKeyboardOpen();
 if(keyboard&&!memoKeyboardActive){
  memoKeyboardActive=true;
  memoPreKeyboardTop=notePanel.getBoundingClientRect().top;
  memoDraggedDuringKeyboard=false;
  // Do not auto-move the note: the learner decides how far to drag it.
 }else if(!keyboard&&memoKeyboardActive){
  memoKeyboardActive=false;
  const restore=memoPreKeyboardTop;
  memoPreKeyboardTop=null;
  requestAnimationFrame(()=>{
   if($('memoModal').hidden||dragStart)return;
   const y=memoDraggedDuringKeyboard&&Number.isFinite(restore)?restore:notePanel.getBoundingClientRect().top;
   notePanel.style.top=memoAllowedY(y)+'px';notePanel.style.bottom='auto';
   memoDraggedDuringKeyboard=false;
   lockAppHeight();
  });
 }else if(!keyboard&&!dragStart&&notePanel.style.top){
  notePanel.style.top=memoAllowedY(notePanel.getBoundingClientRect().top)+'px';
 }
}
memoField.addEventListener('focus',()=>requestAnimationFrame(watchMemoViewport));
memoField.addEventListener('blur',()=>setTimeout(()=>{watchMemoViewport();lockAppHeight()},250));
window.visualViewport?.addEventListener('resize',watchMemoViewport);
window.visualViewport?.addEventListener('scroll',watchMemoViewport);
window.addEventListener('resize',()=>{
 watchMemoViewport();
 if(!isMemoKeyboardOpen()&&!memoKeyboardActive){
  // Browser chrome bars may also resize; ignore keyboard-sized shrink events.
  const h=Math.max(window.innerHeight,document.documentElement.clientHeight);
  if(h>=noteFullHeight-90)lockAppHeight();
 }
});
window.addEventListener('orientationchange',()=>{
 setTimeout(()=>{
  memoKeyboardActive=false;
  noteFullHeight=Math.max(window.innerHeight,document.documentElement.clientHeight);
  lockAppHeight();watchMemoViewport();
 },400);
});
$('openVideoLibrary').addEventListener('click',()=>{$('videoLibraryStatus').textContent=$('mobileFileStatus').textContent||'MP4를 선택하세요.';$('videoLibraryModal').hidden=false});$('closeVideoLibrary').addEventListener('click',()=>$('videoLibraryModal').hidden=true);$('pickManyDialog').addEventListener('click',()=>$('multipleFiles').click());$('pickOneDialog').addEventListener('click',()=>$('singleFile').click());
$('mobileRegister').addEventListener('click',()=>$('multipleFiles').click());$('mobileRegisterSingle').addEventListener('click',()=>$('singleFile').click());$('registerBtn').addEventListener('click',()=>$('singleFile').click());$('registerAllBtn').addEventListener('click',()=>$('multipleFiles').click());$('singleFile').addEventListener('change',e=>{importFiles([...e.target.files],true);e.target.value=''});$('multipleFiles').addEventListener('change',e=>{importFiles([...e.target.files]);e.target.value=''});
// v9: clicking the app brand checks the latest shell, updates its service worker, then refreshes.
// Does not clear localStorage or IndexedDB; existing MP4 / memos / manualDone stay untouched.
let refreshingApp=false;
async function refreshApp(){
  if(refreshingApp)return;
  refreshingApp=true;
  const button=$('updateBtn'),hint=$('updateHint');
  button.classList.add('busy');
  if(hint)hint.textContent='업데이트 확인 중…';
  try{
    // Fresh network request, rather than reading a previously cached index page.
    const response=await fetch('./version.json?check='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw Error('인터넷 또는 GitHub Pages 연결 오류');
    const version=await response.json();
    if(version?.version && $('versionBadge'))$('versionBadge').textContent=String(version.version);
    if('serviceWorker' in navigator){
      const registration=await navigator.serviceWorker.getRegistration('./');
      if(registration){
        await registration.update();
        if(registration.waiting){
          // Skip waiting is safe here: refresh is explicitly requested by the user.
          registration.waiting.postMessage({type:'SKIP_WAITING'});
        }
        if(registration.installing){
          await Promise.race([new Promise(resolve=>{
            const sw=registration.installing;
            sw.addEventListener('statechange',()=>{if(sw.state==='activated'||sw.state==='installed'||sw.state==='redundant')resolve()});
          }),new Promise(resolve=>setTimeout(resolve,5000))]);
        }
      }
    }
    // Keep local records and re-fetch the HTML with a versioned URL.
    location.replace('./index.html?refresh='+Date.now());
  }catch(err){
    alert('최신 버전을 확인하지 못했습니다. 인터넷 연결과 GitHub Pages 게시 상태를 확인해 주세요.\n'+(err.message||err));
    if(hint)hint.textContent='제목을 눌러 최신 버전 확인';
    button.classList.remove('busy');refreshingApp=false;
  }
}
$('updateBtn').addEventListener('click',refreshApp);
if('serviceWorker' in navigator && location.protocol==='https:'){
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});
}
// The install button is intentionally visible even when install-prompt events are unsupported.
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;});
window.addEventListener('appinstalled',()=>{deferredPrompt=null;});
$('installBtn').addEventListener('click',async()=>{
  if(deferredPrompt){
    const prompt=deferredPrompt;deferredPrompt=null;
    await prompt.prompt();
    await prompt.userChoice;
    return;
  }
  if(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone){
    alert('이미 앱으로 실행 중입니다.');return;
  }
  const ua=navigator.userAgent||'';
  if(/iPhone|iPad|iPod/i.test(ua)){
    alert('iPhone / iPad에서는 Safari로 앱 주소를 연 뒤 공유 버튼 → 홈 화면에 추가를 선택하세요.');
  }else if(/KAKAOTALK/i.test(ua)){
    alert('카카오톡 화면에서는 앱 설치가 제한됩니다. 오른쪽 위 메뉴에서 Chrome 등 외부 브라우저로 열고 메뉴 → 홈 화면에 추가 또는 앱 설치를 선택하세요.');
  }else{
    alert('브라우저의 메뉴(⋮ 또는 ⋯)에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요. 설치 메뉴가 보이지 않으면 Chrome 또는 Edge에서 HTTPS 앱 주소를 열어 주세요.');
  }
});
start();
