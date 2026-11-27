<?php
// Admin / Super Admin API: all management pages and actions
require 'config.php';
$p=$_GET['p']??'dash';
// ---------- first-run setup ----------
if(!q('SELECT 1 FROM users LIMIT 1')->fetch()){
 if($_SERVER['REQUEST_METHOD']==='POST'){chk();$u=trim($_POST['u']??'');$n=trim($_POST['n']??'');$pw=(string)($_POST['pw']??'');
  if($u&&$n&&strlen($pw)>=10){q("INSERT INTO users(username,password_hash,full_name,role) VALUES(?,?,?,'superadmin')",[$u,password_hash($pw,PASSWORD_DEFAULT),$n]);done('ok','Super Admin created. Please log in.','login.html?r=superadmin');}
  done('err','All fields are required and the password needs at least 10 characters.');}
 out(['setup'=>true,'csrf'=>csrf()]);}
$U=cur_user();
if(!$U)out(['login'=>true],401);
$SA=$U['role']==='superadmin';
function sa(){global $SA;if(!$SA)out(['error'=>'Forbidden: Super Admin only.'],403);}
// ---------- actions ----------
if($_SERVER['REQUEST_METHOD']==='POST'){chk();$a=$_POST['a']??'';$eid=(int)($_POST['eid']??0);
 $E=$eid?q('SELECT * FROM elections WHERE id=?',[$eid])->fetch():null;$draft=$E&&$E['status']==='draft';
 $lock=fn()=>done('err','This change is only allowed while the election is in Draft status.');
 try{switch($a){
 case 'el_save':
  $t=trim($_POST['t']??'');$s=strtotime(str_replace('T',' ',$_POST['s']??''));$en=strtotime(str_replace('T',' ',$_POST['e']??''));
  if(!$t||!$s||!$en||$en<=$s)done('err','Title is required and the end must be after the start.');
  $s=date('Y-m-d H:i:s',$s);$en=date('Y-m-d H:i:s',$en);
  if($E){if($E['status']==='closed')done('err','Closed elections cannot be edited.');
   q('UPDATE elections SET title=?,description=?,guidelines=?,start_at=?,end_at=? WHERE id=?',[$t,$_POST['d']??'',$_POST['g']??'',$s,$en,$eid]);logit('election_edit',$t);done('ok','Election updated.');}
  else{q('INSERT INTO elections(title,description,guidelines,start_at,end_at,created_by) VALUES(?,?,?,?,?,?)',[$t,$_POST['d']??'',$_POST['g']??'',$s,$en,$U['id']]);$nid=$pdo->lastInsertId();logit('election_create',$t);done('ok','Election created.','admin.html?p=el&id='.$nid);}
  break;
 case 'el_status':$st=$_POST['st']??'';
  if(!$E||!in_array($st,['open','closed','draft']))done();
  if($E['status']==='closed')done('err','A closed election cannot be changed.');
  if($st==='open'&&!q("SELECT COUNT(*) FROM candidates WHERE election_id=? AND status='Approved'",[$eid])->fetchColumn())done('err','Approve at least one candidate before opening.');
  if($st==='draft'&&q('SELECT COUNT(*) FROM participation WHERE election_id=?',[$eid])->fetchColumn())done('err','Votes already exist; the election cannot return to Draft.');
  q('UPDATE elections SET status=? WHERE id=?',[$st,$eid]);logit('election_status',$E['title'].' -> '.$st);done('ok','Election status set to '.$st.'. Voting follows the configured schedule.');
 case 'el_pub':
  if(!$E||$E['status']!=='closed')done('err','Close the election before publishing results.');
  $v=(int)($_POST['v']??0);q('UPDATE elections SET results_published=? WHERE id=?',[$v,$eid]);logit('results_'.($v?'publish':'unpublish'),$E['title']);done('ok',$v?'Results published to students.':'Results hidden from students.');
 case 'pos_add':if(!$draft)$lock();$m=max(1,min(10,(int)($_POST['m']??1)));$nm=trim($_POST['n']??'');if(!$nm)done('err','Position name required.');
  q('INSERT INTO positions(election_id,name,max_select,sort) VALUES(?,?,?,?)',[$eid,$nm,$m,(int)q('SELECT COUNT(*) FROM positions WHERE election_id=?',[$eid])->fetchColumn()]);logit('position_add',$nm);done('ok','Position added.');
 case 'pos_del':if(!$draft)$lock();q('DELETE FROM positions WHERE id=? AND election_id=?',[(int)($_POST['id']??0),$eid]);logit('position_delete','#'.(int)($_POST['id']??0));done('ok','Position removed.');
 case 'cand_add':case 'cand_save':
  if(!$draft)$lock();
  $pos=q('SELECT id FROM positions WHERE id=? AND election_id=?',[(int)($_POST['pos']??0),$eid])->fetch();if(!$pos)done('err','Choose a valid position.');
  $ph=upl($_FILES['photo']??[]);$f=[$pos['id'],trim($_POST['party']??''),$_POST['bio']??'',$_POST['cred']??'',$_POST['plat']??''];
  if($a==='cand_add'){$l=preg_replace('/\D/','',$_POST['lrn']??'');$s=q('SELECT * FROM students WHERE lrn=?',[$l])->fetch();
   if(!$s)done('err','LRN not found in the registered student records.');
   q('INSERT INTO candidates(election_id,position_id,party,bio,credentials,platform,student_id,photo) VALUES(?,?,?,?,?,?,?,?)',array_merge([$eid],$f,[$s['id'],$ph]));logit('candidate_add',$s['full_name']);done('ok','Candidate registered: '.$s['full_name'].'. Status is Pending.');}
  else{$sql='UPDATE candidates SET position_id=?,party=?,bio=?,credentials=?,platform=?';$v=$f;if($ph){$sql.=',photo=?';$v[]=$ph;}
   q($sql.' WHERE id=? AND election_id=?',array_merge($v,[(int)($_POST['id']??0),$eid]));logit('candidate_edit','#'.(int)($_POST['id']??0));done('ok','Candidate updated.','admin.html?p=el&id='.$eid);}
  break;
 case 'cand_status':if(!$draft)$lock();$st=$_POST['st']??'';if(!in_array($st,['Pending','Approved','Rejected']))done();
  q('UPDATE candidates SET status=? WHERE id=? AND election_id=?',[$st,(int)($_POST['id']??0),$eid]);logit('candidate_'.$st,'#'.(int)($_POST['id']??0));done('ok','Candidate marked '.$st.'.');
 case 'cand_del':if(!$draft)$lock();q('DELETE FROM candidates WHERE id=? AND election_id=?',[(int)($_POST['id']??0),$eid]);logit('candidate_delete','#'.(int)($_POST['id']??0));done('ok','Candidate removed.');
 case 'ann_add':$t=trim($_POST['t']??'');if(!$t||!trim($_POST['b']??''))done('err','Title and message required.');
  q('INSERT INTO announcements(election_id,title,body) VALUES(?,?,?)',[$eid?:null,$t,$_POST['b']]);logit('announcement_add',$t);done('ok','Announcement published.');
 case 'ann_del':q('DELETE FROM announcements WHERE id=?',[(int)($_POST['id']??0)]);logit('announcement_delete','#'.(int)($_POST['id']??0));done('ok','Announcement deleted.');
 case 'stu_save':sa();$l=preg_replace('/\D/','',$_POST['lrn']??'');$n=trim($_POST['n']??'');$gr=trim($_POST['gr']??'');$sc=trim($_POST['sc']??'');
  $un=trim($_POST['un']??'');if($un==='')$un=$l;$pw=(string)($_POST['pw']??'');$id=(int)($_POST['id']??0);
  if(strlen($l)!==12||!$n||!$gr||!$sc)done('err','Name, grade, section and a 12-digit LRN are required.');
  if(!preg_match('/^[A-Za-z0-9._-]{3,50}$/',$un))done('err','Username must be 3-50 characters: letters, numbers, dot, dash or underscore.');
  if(ctype_digit($un)&&strlen($un)===12&&$un!==$l)done('err','A 12-digit username must match the student\'s own LRN.');
  if(!$id&&strlen($pw)<8)done('err','Set a password of at least 8 characters for the new student.');
  if($id&&$pw!==''&&strlen($pw)<8)done('err','Password needs at least 8 characters.');
  $v=[$l,$n,$gr,$sc,($_POST['st']??'')==='Inactive'?'Inactive':'Active',empty($_POST['el'])?0:1,$un];
  if($id){$sql='UPDATE students SET lrn=?,full_name=?,grade=?,section=?,status=?,eligible=?,username=?';if($pw!==''){$sql.=',password_hash=?';$v[]=password_hash($pw,PASSWORD_DEFAULT);}
   q($sql.' WHERE id=?',array_merge($v,[$id]));logit('student_edit','#'.$id);done('ok','Student updated.');}
  else{$v[]=password_hash($pw,PASSWORD_DEFAULT);q('INSERT INTO students(lrn,full_name,grade,section,status,eligible,username,password_hash) VALUES(?,?,?,?,?,?,?,?)',$v);logit('student_add',$n);done('ok','Student registered. Username: '.$un);}
  break;
 case 'stu_pw':sa();if(strlen((string)($_POST['pw']??''))<8)done('err','Password needs at least 8 characters.');
  q('UPDATE students SET password_hash=? WHERE id=?',[password_hash($_POST['pw'],PASSWORD_DEFAULT),(int)($_POST['id']??0)]);logit('student_password','#'.(int)($_POST['id']??0));done('ok','Student password set.');
 case 'stu_toggle':sa();q('UPDATE students SET eligible=1-eligible WHERE id=?',[(int)($_POST['id']??0)]);logit('student_eligibility','#'.(int)($_POST['id']??0));done('ok','Eligibility changed.');
 case 'adm_add':sa();$u=trim($_POST['u']??'');$n=trim($_POST['n']??'');$r=($_POST['r']??'')==='superadmin'?'superadmin':'admin';
  if(!$u||!$n||strlen((string)($_POST['pw']??''))<10)done('err','All fields required; password needs 10+ characters.');
  q('INSERT INTO users(username,password_hash,full_name,role) VALUES(?,?,?,?)',[$u,password_hash($_POST['pw'],PASSWORD_DEFAULT),$n,$r]);logit('admin_add',$u);done('ok','Account created.');
 case 'adm_toggle':sa();$id=(int)($_POST['id']??0);if($id===(int)$U['id'])done('err','You cannot deactivate your own account.');
  q('UPDATE users SET active=1-active WHERE id=?',[$id]);logit('admin_toggle','#'.$id);done('ok','Account status changed.');
 case 'adm_pw':sa();if(strlen((string)($_POST['pw']??''))<10)done('err','Password needs 10+ characters.');
  q('UPDATE users SET password_hash=? WHERE id=?',[password_hash($_POST['pw'],PASSWORD_DEFAULT),(int)($_POST['id']??0)]);logit('admin_password','#'.(int)($_POST['id']??0));done('ok','Password reset.');
 }}catch(PDOException $x){done('err',$x->getCode()=='23000'?'That record already exists or is in use (for example, a duplicate LRN or username).':'Database error.');}
 catch(RuntimeException $x){done('err',$x->getMessage());}
 done();}
// ---------- views (JSON data for the pages) ----------
$elig=(int)q("SELECT COUNT(*) FROM students WHERE status='Active' AND eligible=1")->fetchColumn();
$base=['csrf'=>csrf(),'me'=>['username'=>$U['username'],'role'=>$U['role']],'elig'=>$elig];
// ---------- DASHBOARD ----------
if($p==='dash'){
 $now=date('Y-m-d H:i:s');
 $act=q("SELECT COUNT(*) FROM elections WHERE status='open' AND start_at<=? AND end_at>=?",[$now,$now])->fetchColumn();
 $up=q("SELECT COUNT(*) FROM elections WHERE status<>'closed' AND start_at>?",[$now])->fetchColumn();
 $done=q("SELECT COUNT(*) FROM elections WHERE status='closed'")->fetchColumn();
 $tiles=[['Eligible voters',$elig],['Elections',(int)q('SELECT COUNT(*) FROM elections')->fetchColumn()],['Active',(int)$act],['Upcoming',(int)$up],['Completed',(int)$done]];
 if($SA){$tiles[]=['Registered students',(int)q('SELECT COUNT(*) FROM students')->fetchColumn()];$tiles[]=['Administrators',(int)q('SELECT COUNT(*) FROM users WHERE active=1')->fetchColumn()];}
 $rows=[];foreach(q('SELECT * FROM elections ORDER BY start_at DESC')->fetchAll() as $e){
  $e=eout($e);$e['votes']=(int)q('SELECT COUNT(*) FROM participation WHERE election_id=?',[$e['id']])->fetchColumn();
  $e['turnout']=$elig?round($e['votes']*100/$elig,1):0;$e['cands']=(int)q("SELECT COUNT(*) FROM candidates WHERE election_id=? AND status='Approved'",[$e['id']])->fetchColumn();$rows[]=$e;}
 out($base+['tiles'=>$tiles,'elections'=>$rows]);}
// ---------- ELECTIONS ----------
if($p==='el'&&empty($_GET['id']))out($base+['elections'=>array_map('eout',q('SELECT * FROM elections ORDER BY start_at DESC')->fetchAll())]);
if($p==='el'){$eid=(int)$_GET['id'];$E=q('SELECT * FROM elections WHERE id=?',[$eid])->fetch();if(!$E)done('err','Election not found.','admin.html?p=el');
 $E=eout($E);$v=(int)q('SELECT COUNT(*) FROM participation WHERE election_id=?',[$eid])->fetchColumn();
 $P=q('SELECT * FROM positions WHERE election_id=? ORDER BY sort,id',[$eid])->fetchAll();
 $ed=(int)($_GET['edit']??0);$EC=$ed?q('SELECT c.*,s.full_name FROM candidates c JOIN students s ON s.id=c.student_id WHERE c.id=? AND c.election_id=?',[$ed,$eid])->fetch():null;
 $cands=q('SELECT c.*,s.full_name,s.grade,s.section,p.name pn FROM candidates c JOIN students s ON s.id=c.student_id JOIN positions p ON p.id=c.position_id WHERE c.election_id=? ORDER BY p.sort,s.full_name',[$eid])->fetchAll();
 out($base+['election'=>$E,'votes'=>$v,'turnout'=>$elig?round($v*100/$elig,1):0,'positions'=>$P,'candidates'=>$cands,'edit'=>$EC?:null,'results'=>$E['status']!=='draft'?results($eid):null]);}
// ---------- ANNOUNCEMENTS ----------
if($p==='ann')out($base+['elections'=>q('SELECT id,title FROM elections ORDER BY id DESC')->fetchAll(),
 'announcements'=>array_map(function($a){$a['created_fmt']=dt($a['created_at']);return $a;},q('SELECT * FROM announcements ORDER BY id DESC')->fetchAll())]);
sa();
// ---------- STUDENTS (Super Admin) ----------
if($p==='stu'){
 $qs=trim($_GET['q']??'');$g=trim($_GET['g']??'');$w=['1=1'];$ar=[];
 if($qs!==''){$w[]='(full_name LIKE ? OR lrn LIKE ? OR section LIKE ?)';array_push($ar,"%$qs%","%$qs%","%$qs%");}
 if($g!==''){$w[]='grade=?';$ar[]=$g;}
 $strip=function($s){$s['has_pw']=!empty($s['password_hash']);unset($s['password_hash']);return $s;};
 $rows=array_map($strip,q('SELECT * FROM students WHERE '.implode(' AND ',$w).' ORDER BY full_name LIMIT 300',$ar)->fetchAll());
 $ed=(int)($_GET['edit']??0);$S=$ed?q('SELECT * FROM students WHERE id=?',[$ed])->fetch():null;
 out($base+['rows'=>$rows,'student'=>$S?$strip($S):null,'q'=>$qs,'g'=>$g]);}
// ---------- ADMIN ACCOUNTS ----------
if($p==='adm')out($base+['users'=>array_map(function($u){unset($u['password_hash']);return $u;},q('SELECT * FROM users ORDER BY role,full_name')->fetchAll())]);
// ---------- LOGS ----------
if($p==='logs')out($base+['logs'=>array_map(function($l){$l['created_fmt']=dt($l['created_at']);return $l;},q('SELECT l.*,u.username FROM logs l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.id DESC LIMIT 300')->fetchAll())]);
done(null,null,'admin.html');
