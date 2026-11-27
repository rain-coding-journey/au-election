<?php
// Student portal API: dashboard, election details, ballot, change password
require 'config.php';
$S=cur_student();
if(!$S)out(['login'=>true],401);
$a=$_GET['a']??($_POST['a']??'home');
$eid=(int)($_GET['id']??($_POST['id']??0));
$E=$eid?q("SELECT * FROM elections WHERE id=? AND status<>'draft'",[$eid])->fetch():null;
$voted=fn($e)=>(bool)q('SELECT 1 FROM participation WHERE election_id=? AND student_id=?',[$e,$S['id']])->fetch();
$me=['full_name'=>$S['full_name'],'grade'=>$S['grade'],'section'=>$S['section']];
// ---------- CHANGE PASSWORD ----------
if($a==='pw'){
 if($_SERVER['REQUEST_METHOD']!=='POST')out(['csrf'=>csrf(),'me'=>$me]);
 chk();$st=q('SELECT password_hash FROM students WHERE id=?',[$S['id']])->fetch();$n=(string)($_POST['new']??'');
 if(!password_verify((string)($_POST['cur']??''),$st['password_hash']??''))done('err','Current password is incorrect.');
 if(strlen($n)<8)done('err','New password needs at least 8 characters.');
 if($n!==(string)($_POST['new2']??''))done('err','The new passwords do not match.');
 q('UPDATE students SET password_hash=? WHERE id=?',[password_hash($n,PASSWORD_DEFAULT),$S['id']]);logit('student_password_change','#'.$S['id']);
 done('ok','Password changed.');}
// ---------- HOME ----------
if($a==='home'){
 $es=array_map(function($e)use($voted){$e=eout($e);$e['voted']=$voted($e['id']);return $e;},q("SELECT * FROM elections WHERE status<>'draft' ORDER BY start_at DESC")->fetchAll());
 out(['csrf'=>csrf(),'me'=>$me,'elections'=>$es,'announcements'=>announcements(10)]);}
if(!$E)done('err','Election not found.','index.html');
$P=q('SELECT * FROM positions WHERE election_id=? ORDER BY sort,id',[$eid])->fetchAll();
// ---------- ELECTION DETAILS ----------
if($a==='election'){
 foreach($P as $i=>$pos)$P[$i]['candidates']=q("SELECT c.*,s.full_name,s.grade,s.section FROM candidates c JOIN students s ON s.id=c.student_id WHERE c.position_id=? AND c.status='Approved' ORDER BY s.full_name",[$pos['id']])->fetchAll();
 $res=($E['results_published']&&$E['status']==='closed')?results($eid):null;
 out(['csrf'=>csrf(),'me'=>$me,'election'=>eout($E),'voted'=>$voted($eid),'positions'=>$P,'results'=>$res]);}
// ---------- BALLOT ----------
if($a==='ballot'||$a==='review'||$a==='submit'){
 if(!isopen($E))done('err','Voting is currently closed.','index.html');
 if($voted($eid))done('warn','You have already submitted your vote.','index.html');
 $C=[];
 foreach(q("SELECT c.*,s.full_name FROM candidates c JOIN students s ON s.id=c.student_id WHERE c.election_id=? AND c.status='Approved' ORDER BY s.full_name",[$eid])->fetchAll() as $c)$C[$c['position_id']][$c['id']]=$c;
 if($a==='ballot'){
  $cl=[];foreach($C as $pid=>$cs)foreach($cs as $c)$cl[$pid][]=['id'=>(int)$c['id'],'full_name'=>$c['full_name'],'photo'=>$c['photo'],'party'=>$c['party']];
  out(['csrf'=>csrf(),'me'=>$me,'election'=>eout($E),'positions'=>$P,'candidates'=>(object)$cl]);}
 chk();$sel=[];$err='';$n=0;
 foreach($P as $pos){$ids=array_values(array_unique(array_filter((array)($_POST['sel'][$pos['id']]??[]),fn($x)=>$x!=='')));
  foreach($ids as $i){if(!isset($C[$pos['id']][(int)$i])){$err='Invalid selection detected.';}}
  if(count($ids)>$pos['max_select'])$err='You may select at most '.$pos['max_select'].' for '.$pos['name'].'.';
  $sel[$pos['id']]=array_map('intval',$ids);$n+=count($ids);}
 if(!$err&&$n===0)$err='Select at least one candidate before continuing.';
 if($err)out(['err'=>$err]);
 if($a==='review')out(['ok'=>true]);
 try{$pdo->beginTransaction();
  q('INSERT INTO participation(election_id,student_id) VALUES(?,?)',[$eid,$S['id']]);
  $b=bin2hex(random_bytes(16));q('INSERT INTO ballots(id,election_id) VALUES(?,?)',[$b,$eid]);
  foreach($sel as $pid=>$cs)foreach($cs as $cid)q('INSERT INTO votes(ballot_id,election_id,position_id,candidate_id) VALUES(?,?,?,?)',[$b,$eid,$pid,$cid]);
  $pdo->commit();logit('vote_cast','Election '.$eid);out(['ok'=>true,'submitted'=>true]);}
 catch(PDOException $x){if($pdo->inTransaction())$pdo->rollBack();done('warn',$x->getCode()==23000?'You have already submitted your vote.':'Your vote could not be saved. Please try again.','index.html');}}
done(null,null,'index.html');
