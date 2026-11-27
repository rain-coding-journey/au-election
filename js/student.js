/* Student portal: dashboard, election details, ballot, change password */
var NAV=[['index.html','Dashboard'],['index.html?p=pw','Change password'],['index.html?p=out','Log out']];
var P=qs('p')||'home';
var EID=parseInt(qs('id'),10)||0;
var BALLOT=null;   // ballot data + selections kept in memory between "review" and "go back"

function pageS(t,html){page(t,'student',NAV,html);}

function load(url){
 return api(url).then(function(d){
  if(d.login){go('login.html');return null;}
  if(d.flash||d.go){if(d.flash)flash(d.flash[0],d.flash[1]);if(d.go)go(d.go);return null;}
  if(d.error){fatal(d.error);return null;}
  return d;});
}

// ---------- HOME ----------
function home(){
 load('api/student.php?a=home').then(function(d){if(!d)return;
  var o='<p>Grade '+h(d.me.grade)+' - '+h(d.me.section)+'</p><h3>Elections</h3>';
  d.elections.forEach(function(e){
   o+='<div class="card"><b>'+h(e.title)+'</b> '+bd(e.state[0],e.state[1])+' '+(e.voted?bd('You have voted','green'):bd('Not yet voted'))+
    '<br><small>'+h(e.start_fmt)+' to '+h(e.end_fmt)+'</small><p>'+h(e.description)+'</p><a class="btn sec" href="?p=e&id='+e.id+'">Details and candidates</a> ';
   if(e.is_open&&!e.voted)o+='<a class="btn" href="?p=vote&id='+e.id+'">Vote now</a>';
   if(e.results_published==1)o+=' <a class="btn" href="?p=e&id='+e.id+'#results">View results</a>';
   o+='</div>';});
  if(!d.elections.length)o+='<p class="empty">No elections have been announced yet.</p>';
  o+='<h3>Announcements</h3>';
  d.announcements.forEach(function(a){o+='<div class="card"><b>'+h(a.title)+'</b> <small>'+h(a.created_fmt)+'</small><pre>'+h(a.body)+'</pre></div>';});
  if(!d.announcements.length)o+='<p class="empty">No announcements.</p>';
  pageS('Welcome, '+d.me.full_name,o);});
}

// ---------- ELECTION DETAILS ----------
function election(){
 load('api/student.php?a=election&id='+EID).then(function(d){if(!d)return;
  var E=d.election;
  var o='<div class="card">'+bd(E.state[0],E.state[1])+' <small>'+h(E.start_fmt)+' to '+h(E.end_fmt)+'</small><p>'+h(E.description)+'</p><h3>Voting guidelines</h3><pre>'+h(E.guidelines||'No guidelines posted.')+'</pre>';
  if(E.is_open&&!d.voted)o+='<p><a class="btn" href="?p=vote&id='+E.id+'">Vote now</a></p>';
  else if(d.voted)o+='<p class="msg ok">You have already submitted your vote.</p>';
  else o+='<p class="msg warn">Voting is currently closed.</p>';
  o+='</div><h3>Candidates</h3>';
  d.positions.forEach(function(pos){
   o+='<section class="card"><h3>'+h(pos.name)+'</h3>';
   pos.candidates.forEach(function(c){
    o+='<div class="cand">'+(c.photo?'<img class="ph" src="uploads/'+h(c.photo)+'" alt="Photo of '+h(c.full_name)+'">':'<div class="ph"></div>')+
     '<div><b>'+h(c.full_name)+'</b> <small>Grade '+h(c.grade)+' - '+h(c.section)+(c.party?' | '+h(c.party):'')+'</small><br>'+
     (c.bio?'<b>Biography:</b> '+h(c.bio)+'<br>':'')+(c.credentials?'<b>Credentials:</b> '+h(c.credentials)+'<br>':'')+(c.platform?'<b>Platform:</b> '+h(c.platform):'')+'</div></div>';});
   if(!pos.candidates.length)o+='<p class="empty">No approved candidates yet.</p>';
   o+='</section>';});
  o+='<h3 id="results">Results</h3>';
  o+=d.results?rv(d.results):'<p class="empty">Results have not been officially published.</p>';
  pageS(E.title,o);
  if(location.hash==='#results'){var r=document.getElementById('results');if(r)r.scrollIntoView();}
 });
}

// ---------- BALLOT ----------
function ballot(err){
 var B=BALLOT,o='';
 if(err)o+='<p class="msg err">'+h(err)+'</p>';
 o+='<form id="bf">';
 B.positions.forEach(function(pos){
  var m=parseInt(pos.max_select,10),list=B.candidates[pos.id]||[],cur=B.sel[pos.id]||[];
  o+='<fieldset class="card"><legend><b>'+h(pos.name)+'</b> <small>Select '+(m>1?'up to '+m:'one')+'</small></legend>';
  list.forEach(function(c){
   o+='<label class="opt"><input type="'+(m>1?'checkbox':'radio')+'" name="sel['+pos.id+'][]" value="'+c.id+'"'+(cur.indexOf(c.id)>-1?' checked':'')+(m>1?' data-max="'+m+'" data-g="'+pos.id+'"':'')+'>'+
    (c.photo?'<img class="ph" src="uploads/'+h(c.photo)+'" alt="">':'')+h(c.full_name)+(c.party?' <small>('+h(c.party)+')</small>':'')+'</label>';});
  if(m==1)o+='<label class="opt"><input type="radio" name="sel['+pos.id+'][]" value=""> Abstain</label>';
  if(!list.length)o+='<p class="empty">No candidates.</p>';
  o+='</fieldset>';});
 o+='<button>Review ballot</button></form>';
 pageS('Ballot: '+B.election.title,o);
 var f=document.getElementById('bf');
 // limit checkboxes to the maximum allowed for the position
 f.querySelectorAll('input[data-max]').forEach(function(i){i.addEventListener('change',function(){
  var g=f.querySelectorAll('input[data-g="'+i.dataset.g+'"]:checked');
  if(g.length>+i.dataset.max){i.checked=false;alert('You may select at most '+i.dataset.max+' for this position.');}});});
 f.addEventListener('submit',function(ev){ev.preventDefault();
  var fd=new FormData(f);fd.append('a','review');fd.append('id',EID);
  readSel(f);
  api('api/student.php?a=review&id='+EID,fd).then(function(j){
   if(j.go||j.flash){if(j.flash)flash(j.flash[0],j.flash[1]);if(j.go)go(j.go);return;}
   if(j.login){go('login.html');return;}
   if(j.error){ballot(j.error);return;}
   if(j.err){ballot(j.err);return;}
   review();});});
}
// keep what the student ticked so the ballot can be redrawn (error / go back)
function readSel(f){
 var s={};BALLOT.positions.forEach(function(pos){s[pos.id]=[];});
 f.querySelectorAll('input:checked').forEach(function(i){
  var m=i.name.match(/^sel\[(\d+)\]\[\]$/);if(m&&i.value!=='')s[m[1]].push(parseInt(i.value,10));});
 BALLOT.sel=s;
}
function review(){
 var B=BALLOT;
 var o='<form id="rf" class="card"><p class="msg warn">Please check your choices. Once submitted, your ballot cannot be edited.</p><table><tr><th>Position</th><th>Your selection</th></tr>';
 B.positions.forEach(function(pos){
  o+='<tr><td>'+h(pos.name)+'</td><td>';var t=[];
  (B.sel[pos.id]||[]).forEach(function(i){(B.candidates[pos.id]||[]).forEach(function(c){if(c.id===i){t.push(h(c.full_name));o+='<input type="hidden" name="sel['+pos.id+'][]" value="'+i+'">';}});});
  o+=t.length?t.join(', '):'<i>Abstain</i>';o+='</td></tr>';});
 o+='</table><p><button>Confirm and submit ballot</button> <a class="btn sec" href="?p=vote&id='+EID+'" id="back">Go back</a></p></form>';
 pageS('Review Your Ballot',o);
 document.getElementById('back').addEventListener('click',function(ev){ev.preventDefault();ballot();});
 var f=document.getElementById('rf');
 f.addEventListener('submit',function(ev){ev.preventDefault();if(f._busy)return;f._busy=true;
  var fd=new FormData(f);fd.append('a','submit');fd.append('id',EID);
  api('api/student.php?a=submit&id='+EID,fd).then(function(j){f._busy=false;
   if(j.login){go('login.html');return;}
   if(j.go||j.flash){if(j.flash)flash(j.flash[0],j.flash[1]);if(j.go)go(j.go);return;}
   if(j.err||j.error){ballot(j.err||j.error);return;}
   pageS('Vote Submitted','<div class="card"><p class="msg ok">Your vote was submitted successfully. Your ballot cannot be changed.</p><a class="btn" href="index.html">Back to dashboard</a></div>');});});
}
function startBallot(){
 load('api/student.php?a=ballot&id='+EID).then(function(d){if(!d)return;
  BALLOT={election:d.election,positions:d.positions,candidates:d.candidates,sel:{}};ballot();});
}

// ---------- CHANGE PASSWORD ----------
function pw(){
 load('api/student.php?a=pw').then(function(d){if(!d)return;
  pageS('Change Password','<form class="card login" data-api="api/student.php"><input type="hidden" name="a" value="pw">'+
   '<label>Current password<input type="password" name="cur" required autocomplete="current-password"></label>'+
   '<label>New password (8+ characters)<input type="password" name="new" minlength="8" required autocomplete="new-password"></label>'+
   '<label>Confirm new password<input type="password" name="new2" minlength="8" required autocomplete="new-password"></label>'+
   '<button>Change password</button></form>');});
}

window.onPost=function(j){afterPost(j,pw);};

// ---------- router ----------
if(P==='out')doLogout('login.html');
else if(P==='pw')pw();
else if(P==='home')home();
else if(P==='e'&&EID)election();
else if(P==='vote'&&EID)startBallot();
else load('api/student.php?a=unknown&id='+EID);   // server answers "Election not found." or sends the student back to the dashboard
