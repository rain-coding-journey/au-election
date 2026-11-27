<?php
// Login page data, login and logout (single login for Student, Admin and Super Admin)
require 'config.php';
$roles=['student'=>'Student','admin'=>'Admin','superadmin'=>'Super Admin'];
$a=$_GET['a']??($_POST['a']??'');
if($a==='logout'){chk();$_SESSION=[];session_destroy();out(['ok'=>true]);}
// first run: no accounts yet -> Super Admin setup lives on admin.html
if(!q('SELECT 1 FROM users LIMIT 1')->fetch())out(['setup'=>true,'csrf'=>csrf()]);
if($a==='state'){
 $redir=null;
 if(cur_user())$redir='admin.html';elseif(cur_student())$redir='index.html';
 out(['csrf'=>csrf(),'redirect'=>$redir,'announcements'=>announcements(5)]);}
if($a==='login'&&$_SERVER['REQUEST_METHOD']==='POST'){chk();
 $r=$_POST['role']??'student';if(!isset($roles[$r]))$r='student';$ip=$_SERVER['REMOTE_ADDR']??'';
 $bad=fn($m,$to=null)=>done('err',$m,'login.html?r='.($to??$r));
 $f=q("SELECT COUNT(*) FROM logs WHERE action='login_fail' AND ip=? AND created_at>DATE_SUB(NOW(),INTERVAL 10 MINUTE)",[$ip])->fetchColumn();
 if($f>=6)$bad('Too many failed attempts. Try again in 10 minutes.');
 $un=trim($_POST['id']??'');$pw=(string)($_POST['pw']??'');
 if($r==='student'){
  $s=q('SELECT * FROM students WHERE username=?',[$un])->fetch();
  if($s&&!$s['password_hash'])$bad('Your account has no password yet. Please contact the Super Admin.','student');
  if(!$s||!password_verify($pw,$s['password_hash'])){logit('login_fail',$un);$bad('Invalid username or password.','student');}
  if($s['status']!=='Active'||!$s['eligible'])$bad('You are not eligible to vote in this election.','student');
  session_regenerate_id(true);unset($_SESSION['uid']);$_SESSION['sid']=$s['id'];logit('student_login','#'.$s['id']);out(['ok'=>true,'go'=>'index.html']);
 }
 $u=q('SELECT * FROM users WHERE username=? AND active=1',[$un])->fetch();
 if(!$u||!password_verify($pw,$u['password_hash'])){logit('login_fail',$un);$bad('Invalid username or password.');}
 if($u['role']!==$r)$bad('This account is a '.$roles[$u['role']].' account. Please select "'.$roles[$u['role']].'" and log in again.',$u['role']);
 session_regenerate_id(true);unset($_SESSION['sid']);$_SESSION['uid']=$u['id'];logit('login');out(['ok'=>true,'go'=>'admin.html']);
}
out(['error'=>'Unknown request.'],400);
