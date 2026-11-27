/* Shared helpers for all pages */
var ROLES={student:'Student Voter',admin:'Administrator',superadmin:'Super Admin'};
var CSRF='';
var memFlash=null;

function h(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function bd(t,k){return '<span class="bd '+(k||'')+'">'+h(t)+'</span>';}
function go(u){location.href=u;}
function flash(k,m){try{sessionStorage.setItem('au_flash',JSON.stringify([k,m]));}catch(e){memFlash=[k,m];}}
function takeFlash(){var f=null;
 try{var v=sessionStorage.getItem('au_flash');if(v){f=JSON.parse(v);sessionStorage.removeItem('au_flash');}}catch(e){}
 if(!f&&memFlash){f=memFlash;memFlash=null;}
 return f;}
function qs(name){return new URLSearchParams(location.search).get(name);}

/* Talk to the PHP API. Pass FormData/object as `data` to POST (the CSRF token is added automatically). */
function api(url,data){
 var o={credentials:'same-origin',headers:{'Accept':'application/json'}};
 if(data){var fd=(data instanceof FormData)?data:new FormData();
  if(!(data instanceof FormData))Object.keys(data).forEach(function(k){fd.append(k,data[k]);});
  fd.set('c',CSRF);o.method='POST';o.body=fd;}
 return fetch(url,o).then(function(r){return r.text().then(function(t){var j;
  try{j=JSON.parse(t);}catch(e){j={error:'Unexpected server response. Check that Apache/PHP and MySQL are running and that database.sql was imported.'};}
  j._status=r.status;if(j.csrf)CSRF=j.csrf;return j;});})
 .catch(function(){return {error:'Could not reach the server. Check that Apache is running.',_status:0};});
}

/* Draw the page: header, navigation, flash message, title and body. nav = array of [url,label]. */
function page(title,role,nav,html){
 document.title=title+' - AU Election System';
 document.body.className='role-'+role;
 var n='';(nav||[]).forEach(function(x){n+='<a href="'+h(x[0])+'">'+h(x[1])+'</a>';});
 document.getElementById('hd').innerHTML='<div class="w"><a href="./" class="brand"><img src="logo.png" alt="Arellano University seal"><b>Arellano University - Jose Rizal Campus</b></a><span>Student Election System | '+ROLES[role]+'</span></div><nav class="w">'+n+'</nav>';
 var f=takeFlash();
 document.getElementById('main').innerHTML=(f?'<p class="msg '+h(f[0])+'" role="alert">'+h(f[1])+'</p>':'')+'<h1>'+h(title)+'</h1>'+html;
 window.scrollTo(0,0);
}
function fatal(msg,role){page('Error',role||'student',[],'<p class="msg err">'+h(msg)+'</p>');}

/* Forms with data-api are submitted through fetch. data-confirm shows a confirm dialog first. */
document.addEventListener('submit',function(ev){
 var f=ev.target;if(!f.getAttribute||!f.getAttribute('data-api'))return;
 ev.preventDefault();
 var cm=f.getAttribute('data-confirm');if(cm&&!window.confirm(cm))return;
 if(f._busy)return;f._busy=true;
 api(f.getAttribute('data-api'),new FormData(f)).then(function(j){f._busy=false;if(window.onPost)window.onPost(j,f);});
});

/* Standard reaction to a POST result. `again` re-draws the current page. */
function afterPost(j,again,role){
 if(j._status===401&&j.login){go('login.html');return;}
 if(j.error&&!j.flash){flash('err',j.error);again();return;}
 if(j.flash)flash(j.flash[0],j.flash[1]);
 if(j.go){go(j.go);return;}
 again();
}

function doLogout(back){
 api('api/auth.php?a=state').then(function(){return api('api/auth.php',{a:'logout'});}).then(function(){go(back||'login.html');});
}

/* Results tables (used by the student results page and the admin vote counts) */
function rv(R){
 if(!R||!R.length)return '<p class="empty">No positions.</p>';
 var o='';
 R.forEach(function(p){
  o+='<section class="card"><h3>'+h(p.name)+' <small>'+p.total+' votes</small></h3><div class="tw"><table><tr><th>Rank</th><th>Candidate</th><th>Votes</th><th>Share</th><th></th></tr>';
  p.c.forEach(function(x){
   var w=p.c[0].n>0&&x.rank==1&&(p.c.length==1||p.c[1].n<x.n);
   o+='<tr><td>'+x.rank+'</td><td>'+(x.photo?'<img class="ph" src="uploads/'+h(x.photo)+'" alt="">':'')+h(x.full_name)+
    (w?' '+bd('Winner','green'):(x.rank==1&&x.n>0?' '+bd('Tie','gold'):''))+'</td><td>'+x.n+'</td><td><div class="bar"><i style="width:'+x.pct+'%"></i></div>'+x.pct+'%</td></tr>';});
  if(!p.c.length)o+='<tr><td colspan="5" class="empty">No approved candidates.</td></tr>';
  o+='</table></div></section>';});
 return o;
}

