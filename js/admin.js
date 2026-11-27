/* Admin / Super Admin pages: dashboard, elections, announcements, students, administrators, logs */
var P=qs('p')||'dash';
var ME=null;

function navFor(d){
 var n=[['admin.html','Dashboard'],['admin.html?p=el','Elections'],['admin.html?p=ann','Announcements']];
 if(d.me.role==='superadmin')n.push(['admin.html?p=stu','Student Voters'],['admin.html?p=adm','Administrators'],['admin.html?p=logs','Activity Logs']);
 n.push(['admin.html?p=logout','Log out ('+d.me.username+')']);
 return n;
}
function pg(d,t,html){page(t,d.me.role==='superadmin'?'superadmin':'admin',navFor(d),html);}
/* Opening tag of a small inline POST form (the caller adds the button and </form>) */
function F(a,extra,msg){return '<form method="post" class="inl" data-api="api/admin.php"'+(msg?' data-confirm="'+h(msg)+'"':'')+'><input type="hidden" name="a" value="'+a+'">'+(extra||'');}
function hid(n,v){return '<input type="hidden" name="'+n+'" value="'+h(v)+'">';}

function load(url,cb){
 api(url).then(function(d){
  if(d.setup){setup(d);return;}
  if(d.login){go('login.html');return;}
  if(d.flash||d.go){if(d.flash)flash(d.flash[0],d.flash[1]);if(d.go)go(d.go);return;}
  if(d.error){
   if(d._status===403){page('Error','admin',[['admin.html','Dashboard']],'<p class="msg err">'+h(d.error)+'</p>');return;}
   fatal(d.error,'admin');return;}
  ME=d;cb(d);});
}

// ---------- first-run setup ----------
function setup(d){
 page('First-time Setup','superadmin',[],
  '<form class="card login" data-api="api/admin.php"><input type="hidden" name="a" value="setup"><h3>Create the Super Admin account</h3>'+
  '<label>Full name<input name="n" required></label><label>Username<input name="u" required></label>'+
  '<label>Password (10+ characters)<input type="password" name="pw" minlength="10" required></label><button>Create account</button></form>');
}

// ---------- DASHBOARD ----------
function dash(){
 load('api/admin.php?p=dash',function(d){
  var o='<div class="grid">';
  d.tiles.forEach(function(t){o+='<div class="stat"><b>'+t[1]+'</b><span>'+h(t[0])+'</span></div>';});
  o+='</div><h3>Election overview and turnout</h3><div class="card tw"><table><tr><th>Election</th><th>Status</th><th>Candidates</th><th>Votes cast</th><th>Not yet voted</th><th>Turnout</th><th></th></tr>';
  d.elections.forEach(function(e){
   o+='<tr><td>'+h(e.title)+'</td><td>'+bd(e.state[0],e.state[1])+'</td><td>'+e.cands+'</td><td>'+e.votes+'</td><td>'+Math.max(0,d.elig-e.votes)+'</td><td>'+e.turnout+'%</td><td><a href="?p=el&id='+e.id+'">Manage</a></td></tr>';});
  o+='</table></div>';
  pg(d,d.me.role==='superadmin'?'Super Admin Dashboard':'Admin Dashboard',o);});
}

// ---------- ELECTIONS ----------
function elList(){
 load('api/admin.php?p=el',function(d){
  var o='<div class="card tw"><table><tr><th>Title</th><th>Status</th><th>Schedule</th><th>Results</th><th></th></tr>';
  d.elections.forEach(function(e){
   o+='<tr><td>'+h(e.title)+'</td><td>'+bd(e.state[0],e.state[1])+'</td><td>'+h(e.start_fmt)+' to '+h(e.end_fmt)+'</td><td>'+(e.results_published==1?bd('Published','green'):bd('Hidden'))+'</td><td><a href="?p=el&id='+e.id+'">Manage</a></td></tr>';});
  o+='</table></div><form method="post" class="card" data-api="api/admin.php"><input type="hidden" name="a" value="el_save"><h3>Create election</h3>'+
   '<label>Title<input name="t" required></label><label>Description<textarea name="d"></textarea></label>'+
   '<div class="row"><label>Voting starts<input type="datetime-local" name="s" required></label><label>Voting ends<input type="datetime-local" name="e" required></label></div>'+
   '<label>Voting guidelines<textarea name="g"></textarea></label><button>Create election</button></form>';
  pg(d,'Elections',o);});
}

function elView(){
 var eid=parseInt(qs('id'),10)||0,ed=parseInt(qs('edit'),10)||0;
 load('api/admin.php?p=el&id='+eid+(ed?'&edit='+ed:''),function(d){
  var E=d.election,draft=E.status==='draft',H=hid('eid',eid),elig=d.elig,v=d.votes,P=d.positions;
  var o='<div class="grid"><div class="stat"><b>'+v+'</b><span>Votes cast</span></div><div class="stat"><b>'+Math.max(0,elig-v)+'</b><span>Not yet voted</span></div>'+
   '<div class="stat"><b>'+d.turnout+'%</b><span>Turnout of '+elig+' eligible</span></div><div class="stat"><b>'+bd(E.state[0],E.state[1])+'</b><span>Status</span></div></div>';
  o+='<div class="card"><b>Status controls</b><br>';
  if(draft)o+=F('el_status',H+hid('st','open'),'Open this election? Candidates, positions and details will be locked.')+'<button>Open election</button></form> ';
  if(E.status==='open')o+=F('el_status',H+hid('st','draft'),'Return to Draft?')+'<button class="sec">Return to Draft</button></form> ';
  if(E.status!=='closed')o+=F('el_status',H+hid('st','closed'),'Close this election permanently? Voting will stop.')+'<button class="dng">Close election</button></form>';
  else o+=F('el_pub',H+hid('v',E.results_published==1?0:1),'Change result visibility for students?')+'<button>'+(E.results_published==1?'Hide results from students':'Publish results to students')+'</button></form>';
  o+='<p><small>Voting is only accepted while status is Open and the current time is inside the schedule. It closes automatically at the end time.</small></p></div>';
  if(E.status!=='draft')o+='<h3>Vote counts</h3>'+rv(d.results);
  o+='<form method="post" class="card" data-api="api/admin.php">'+H+'<input type="hidden" name="a" value="el_save"><h3>Election details</h3>'+
   '<label>Title<input name="t" value="'+h(E.title)+'" required></label><label>Description<textarea name="d">'+h(E.description)+'</textarea></label>'+
   '<div class="row"><label>Voting starts<input type="datetime-local" name="s" value="'+h(E.start_raw)+'" required></label><label>Voting ends<input type="datetime-local" name="e" value="'+h(E.end_raw)+'" required></label></div>'+
   '<label>Voting guidelines<textarea name="g">'+h(E.guidelines)+'</textarea></label>'+(E.status==='closed'?'':'<button>Save details</button>')+'</form>';
  // positions
  o+='<div class="card tw"><h3>Positions</h3><table><tr><th>Position</th><th>Max selections</th><th></th></tr>';
  P.forEach(function(x){o+='<tr><td>'+h(x.name)+'</td><td>'+x.max_select+'</td><td>'+(draft?F('pos_del',H+hid('id',x.id),'Remove this position and its candidates?')+'<button class="dng">Remove</button></form>':'')+'</td></tr>';});
  if(!P.length)o+='<tr><td colspan="3" class="empty">No positions yet.</td></tr>';
  o+='</table>';
  if(draft)o+='<form method="post" class="row" style="margin-top:12px" data-api="api/admin.php">'+H+'<input type="hidden" name="a" value="pos_add"><label>Position name<input name="n" required></label><label>Max selections<input type="number" name="m" value="1" min="1" max="10"></label><div><br><button>Add position</button></div></form>';
  o+='</div>';
  // candidates
  var EC=d.edit;
  var opts=function(sel){var s='';P.forEach(function(x){s+='<option value="'+x.id+'"'+(x.id==sel?' selected':'')+'>'+h(x.name)+'</option>';});return s;};
  o+='<div class="card tw"><h3>Candidates</h3><table><tr><th>Candidate</th><th>Position</th><th>Status</th><th></th></tr>';
  d.candidates.forEach(function(c){
   o+='<tr><td>'+(c.photo?'<img class="ph" src="uploads/'+h(c.photo)+'" alt="">':'')+h(c.full_name)+' <small>Gr '+h(c.grade)+' - '+h(c.section)+'</small></td><td>'+h(c.pn)+'</td><td>'+bd(c.status,c.status==='Approved'?'green':(c.status==='Rejected'?'red':'gold'))+'</td><td>';
   if(draft){var i=H+hid('id',c.id);
    [['Approved','Approve'],['Rejected','Reject']].forEach(function(kv){if(c.status!==kv[0])o+=F('cand_status',i+hid('st',kv[0]))+'<button class="sec">'+kv[1]+'</button></form> ';});
    o+='<a class="btn sec" href="?p=el&id='+eid+'&edit='+c.id+'">Edit</a> '+F('cand_del',i,'Remove this candidate?')+'<button class="dng">Remove</button></form>';}
   o+='</td></tr>';});
  o+='</table>';
  if(draft&&P.length){
   var c=EC||{position_id:0,party:'',bio:'',credentials:'',platform:''};
   o+='<form method="post" enctype="multipart/form-data" style="margin-top:12px" data-api="api/admin.php">'+H+'<input type="hidden" name="a" value="'+(EC?'cand_save':'cand_add')+'">'+
    (EC?hid('id',EC.id)+'<h4>Edit '+h(EC.full_name)+'</h4>':'<h4>Register candidate by LRN</h4><label>Candidate LRN<input name="lrn" inputmode="numeric" maxlength="12" required></label>')+
    '<div class="row"><label>Position<select name="pos">'+opts(c.position_id)+'</select></label><label>Party or organization (optional)<input name="party" value="'+h(c.party)+'"></label><label>Photo (JPG, PNG, WEBP, max 2 MB)<input type="file" name="photo" accept="image/*"></label></div>'+
    '<label>Short biography<textarea name="bio">'+h(c.bio)+'</textarea></label><label>Credentials or experience<textarea name="cred">'+h(c.credentials)+'</textarea></label><label>Campaign platform<textarea name="plat">'+h(c.platform)+'</textarea></label>'+
    '<button>'+(EC?'Save changes':'Register candidate')+'</button></form>';}
  else if(draft)o+='<p class="empty">Add a position before registering candidates.</p>';
  o+='</div>';
  pg(d,E.title,o);});
}

// ---------- ANNOUNCEMENTS ----------
function ann(){
 load('api/admin.php?p=ann',function(d){
  var o='<form method="post" class="card" data-api="api/admin.php"><input type="hidden" name="a" value="ann_add"><h3>Publish announcement</h3><label>Related election<select name="eid"><option value="0">General (all students)</option>';
  d.elections.forEach(function(e){o+='<option value="'+e.id+'">'+h(e.title)+'</option>';});
  o+='</select></label><label>Title<input name="t" required></label><label>Message<textarea name="b" required></textarea></label><button>Publish</button></form><div class="card tw"><table><tr><th>Title</th><th>Posted</th><th></th></tr>';
  d.announcements.forEach(function(a){o+='<tr><td>'+h(a.title)+'</td><td>'+h(a.created_fmt)+'</td><td>'+F('ann_del',hid('id',a.id),'Delete announcement?')+'<button class="dng">Delete</button></form></td></tr>';});
  o+='</table></div>';
  pg(d,'Announcements',o);});
}

// ---------- STUDENTS (Super Admin) ----------
function stu(){
 var u='api/admin.php?p=stu&q='+encodeURIComponent(qs('q')||'')+'&g='+encodeURIComponent(qs('g')||'')+'&edit='+(parseInt(qs('edit'),10)||0);
 load(u,function(d){
  var S=d.student||{id:'',lrn:'',username:'',full_name:'',grade:'',section:'',status:'Active',eligible:1};
  var o='<form method="get" class="card row"><input type="hidden" name="p" value="stu"><label>Search name, LRN or section<input name="q" value="'+h(d.q)+'"></label><label>Grade level<input name="g" value="'+h(d.g)+'"></label><div><br><button>Search</button> <a class="btn sec" href="?p=stu">Reset</a></div></form>';
  o+='<form method="post" class="card" data-api="api/admin.php"><input type="hidden" name="a" value="stu_save"><input type="hidden" name="id" value="'+h(S.id)+'"><h3>'+(S.id?'Edit student':'Register student')+'</h3><div class="row">'+
   '<label>Full name<input name="n" value="'+h(S.full_name)+'" required></label><label>LRN (12 digits)<input name="lrn" value="'+h(S.lrn)+'" pattern="[0-9]{12}" maxlength="12" required></label>'+
   '<label>Grade level<input name="gr" value="'+h(S.grade)+'" required></label><label>Section<input name="sc" value="'+h(S.section)+'" required></label>'+
   '<label>Username (blank = use LRN)<input name="un" value="'+h(S.username)+'" maxlength="50"></label>'+
   '<label>'+(S.id?'New password (blank = keep)':'Password (8+ characters)')+'<input type="password" name="pw" minlength="8" autocomplete="new-password"'+(S.id?'':' required')+'></label>'+
   '<label>Student status<select name="st"><option>Active</option><option'+(S.status==='Inactive'?' selected':'')+'>Inactive</option></select></label>'+
   '<label><br><input type="checkbox" name="el" value="1"'+(S.eligible==1?' checked':'')+'>Eligible to vote</label></div><button>Save student</button> '+(S.id?'<a class="btn sec" href="?p=stu">Cancel</a>':'')+'</form>';
  o+='<div class="card tw"><table><tr><th>Name</th><th>LRN</th><th>Username</th><th>Grade</th><th>Section</th><th>Status</th><th>Eligible</th><th></th></tr>';
  d.rows.forEach(function(s){
   o+='<tr><td>'+h(s.full_name)+'</td><td>'+h(s.lrn)+'</td><td>'+h(s.username||'-')+(s.has_pw?'':' '+bd('No password','red'))+'</td><td>'+h(s.grade)+'</td><td>'+h(s.section)+'</td><td>'+bd(s.status,s.status==='Active'?'green':'red')+'</td><td>'+(s.eligible==1?'Yes':'No')+'</td><td><a href="?p=stu&edit='+s.id+'">Edit</a> '+
    F('stu_toggle',hid('id',s.id))+'<button class="sec">Toggle eligibility</button></form> '+
    F('stu_pw',hid('id',s.id)+'<input type="password" name="pw" placeholder="New password" minlength="8" required autocomplete="new-password" style="display:inline;width:140px">')+'<button class="sec">Reset password</button></form></td></tr>';});
  if(!d.rows.length)o+='<tr><td colspan="8" class="empty">No students found.</td></tr>';
  o+='</table><small>LRNs and usernames are visible to Super Admin only. Students log in with their username and password.</small></div>';
  pg(d,'Student Voters',o);});
}

// ---------- ADMIN ACCOUNTS ----------
function adm(){
 load('api/admin.php?p=adm',function(d){
  var o='<div class="card tw"><table><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr>';
  d.users.forEach(function(u){var i=hid('id',u.id);
   o+='<tr><td>'+h(u.full_name)+'</td><td>'+h(u.username)+'</td><td>'+h(u.role)+'</td><td>'+bd(u.active==1?'Active':'Disabled',u.active==1?'green':'red')+'</td><td>'+
    F('adm_toggle',i,'Change this account status?')+'<button class="sec">'+(u.active==1?'Deactivate':'Activate')+'</button></form> '+
    F('adm_pw',i+'<input type="password" name="pw" placeholder="New password" minlength="10" required style="display:inline;width:150px">')+'<button class="sec">Reset</button></form></td></tr>';});
  o+='</table></div><form method="post" class="card" data-api="api/admin.php"><input type="hidden" name="a" value="adm_add"><h3>Add account</h3><div class="row">'+
   '<label>Full name<input name="n" required></label><label>Username<input name="u" required></label><label>Password (10+)<input type="password" name="pw" minlength="10" required></label>'+
   '<label>Role<select name="r"><option value="admin">Admin</option><option value="superadmin">Super Admin</option></select></label></div><button>Create account</button></form>';
  pg(d,'Administrator Accounts',o);});
}

// ---------- LOGS ----------
function logs(){
 load('api/admin.php?p=logs',function(d){
  var o='<div class="card tw"><table><tr><th>Time</th><th>User</th><th>Action</th><th>Detail</th><th>IP</th></tr>';
  d.logs.forEach(function(l){o+='<tr><td>'+h(l.created_fmt)+'</td><td>'+h(l.username||'-')+'</td><td>'+h(l.action)+'</td><td>'+h(l.detail)+'</td><td>'+h(l.ip)+'</td></tr>';});
  o+='</table></div>';
  pg(d,'Activity Logs',o);});
}

// ---------- router ----------
var VIEWS={dash:dash,ann:ann,stu:stu,adm:adm,logs:logs};
function render(){
 if(P==='logout'){doLogout('login.html');return;}
 if(P==='login'){go('login.html');return;}
 if(P==='el'){if(qs('id'))elView();else elList();return;}
 if(VIEWS[P]){VIEWS[P]();return;}
 load('api/admin.php?p='+encodeURIComponent(P),function(){go('admin.html');});   // unknown page: 403 for admins, dashboard for super admin
}
window.onPost=function(j){afterPost(j,render);};
render();
