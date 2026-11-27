<?php
// Shared setup for the JSON API. Database credentials: edit the PDO line below.
date_default_timezone_set('Asia/Manila');
ini_set('display_errors','0');
session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax']);session_start();
header('X-Frame-Options: DENY');header('X-Content-Type-Options: nosniff');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
function out($d,$code=200){http_response_code($code);echo json_encode($d,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);exit;}
set_exception_handler(function($e){out(['error'=>'Server error. Check that MySQL is running and database.sql was imported.'],500);});
try{$pdo=new PDO('mysql:host=localhost;dbname=election_db;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);}
catch(PDOException $e){out(['error'=>'Database connection failed. Check credentials in api/config.php and that database.sql was imported.'],500);}
function q($sql,$a=[]){global $pdo;$s=$pdo->prepare($sql);$s->execute($a);return $s;}
function csrf(){if(empty($_SESSION['c']))$_SESSION['c']=bin2hex(random_bytes(16));return $_SESSION['c'];}
function chk(){if(!hash_equals($_SESSION['c']??'',(string)($_POST['c']??'')))out(['error'=>'Invalid request token. Go back and reload the page.'],400);}
// Finish a POST: optional flash message [kind,text] and optional redirect target for the browser
function done($k=null,$m=null,$go=null){$r=['ok'=>true];if($k!==null)$r['flash']=[$k,$m];if($go!==null)$r['go']=$go;out($r);}
function logit($a,$d=''){q('INSERT INTO logs(user_id,action,detail,ip) VALUES(?,?,?,?)',[$_SESSION['uid']??null,$a,substr($d,0,255),$_SERVER['REMOTE_ADDR']??'']);}
function dt($v){return date('M j, Y g:i A',strtotime($v));}
// Elections whose scheduled end has passed are closed automatically
q("UPDATE elections SET status='closed' WHERE status='open' AND end_at<?",[date('Y-m-d H:i:s')]);
function isopen($e){$n=time();return $e['status']==='open'&&$n>=strtotime($e['start_at'])&&$n<=strtotime($e['end_at']);}
// Adds display fields (status badge, formatted dates) to an election row
function eout($e){$e['is_open']=isopen($e);
 if($e['status']==='closed')$s=['Closed','gray'];elseif($e['status']==='draft')$s=['Draft','gray'];
 else $s=$e['is_open']?['Open for voting','green']:['Upcoming','gold'];
 $e['state']=$s;$e['start_fmt']=dt($e['start_at']);$e['end_fmt']=dt($e['end_at']);
 $e['start_raw']=str_replace(' ','T',substr($e['start_at'],0,16));$e['end_raw']=str_replace(' ','T',substr($e['end_at'],0,16));return $e;}
function upl($f){if(empty($f['name'])||$f['error']===UPLOAD_ERR_NO_FILE)return null;
 if($f['error']!==UPLOAD_ERR_OK||$f['size']>2097152)throw new RuntimeException('Photo must be under 2 MB.');
 $i=@getimagesize($f['tmp_name']);$x=[IMAGETYPE_JPEG=>'jpg',IMAGETYPE_PNG=>'png',IMAGETYPE_WEBP=>'webp'];
 if(!$i||!isset($x[$i[2]]))throw new RuntimeException('Photo must be JPG, PNG or WEBP.');
 $n=bin2hex(random_bytes(12)).'.'.$x[$i[2]];move_uploaded_file($f['tmp_name'],dirname(__DIR__).'/uploads/'.$n);return $n;}
function results($eid){$out=[];
 foreach(q('SELECT * FROM positions WHERE election_id=? ORDER BY sort,id',[$eid])->fetchAll() as $p){
  $c=q("SELECT c.*,s.full_name,s.grade,s.section,(SELECT COUNT(*) FROM votes v WHERE v.candidate_id=c.id) n FROM candidates c JOIN students s ON s.id=c.student_id WHERE c.position_id=? AND c.status='Approved' ORDER BY n DESC,s.full_name",[$p['id']])->fetchAll();
  foreach($c as $i=>$x)$c[$i]['n']=(int)$x['n'];
  $t=array_sum(array_column($c,'n'));
  foreach($c as $i=>$x){$c[$i]['pct']=$t?round($x['n']*100/$t,1):0;$c[$i]['rank']=1+count(array_filter($c,fn($y)=>$y['n']>$x['n']));}
  $p['c']=$c;$p['total']=$t;$out[]=$p;}
 return $out;}
function cur_student(){if(empty($_SESSION['sid']))return null;
 $S=q("SELECT * FROM students WHERE id=? AND status='Active' AND eligible=1",[$_SESSION['sid']])->fetch()?:null;
 if(!$S)unset($_SESSION['sid']);return $S;}
function cur_user(){return !empty($_SESSION['uid'])?(q('SELECT * FROM users WHERE id=? AND active=1',[$_SESSION['uid']])->fetch()?:null):null;}
function announcements($n){return array_map(function($a){$a['created_fmt']=dt($a['created_at']);return $a;},
 q("SELECT a.* FROM announcements a LEFT JOIN elections e ON e.id=a.election_id WHERE a.election_id IS NULL OR e.status<>'draft' ORDER BY a.id DESC LIMIT ".(int)$n)->fetchAll());}
