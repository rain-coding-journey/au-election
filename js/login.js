/* Login page: one sign-in for Student, Admin and Super Admin */
var LROLES={student:'Student',admin:'Admin',superadmin:'Super Admin'};

function render(){
 api('api/auth.php?a=state').then(function(d){
  if(d.error){fatal(d.error);return;}
  if(d.setup){go('admin.html');return;}               // first run: create the Super Admin
  if(d.redirect){go(d.redirect);return;}              // already signed in
  var r=qs('r');if(!LROLES[r])r='student';
  var radios='';Object.keys(LROLES).forEach(function(k){
   radios+='<label class="opt"><input type="radio" name="role" value="'+k+'"'+(k===r?' checked':'')+'> <b>'+h(LROLES[k])+'</b></label>';});
  var A=d.announcements||[];
  var ann='<h3>Announcements</h3>';
  A.forEach(function(a){ann+='<div class="card"><b>'+h(a.title)+'</b> <small>'+h(a.created_fmt)+'</small><pre>'+h(a.body)+'</pre></div>';});
  if(!A.length)ann+='<p class="empty">No announcements.</p>';
  page('Login','student',[],
   '<form class="card login" id="lf" data-api="api/auth.php">'+
   '<input type="hidden" name="a" value="login">'+
   '<h3>Sign in to the Election System</h3>'+
   '<p style="margin-top:0">Choose how you are logging in.</p>'+
   '<div id="roles">'+radios+'</div>'+
   '<label>Username<input name="id" required autocomplete="username" autofocus maxlength="100"></label>'+
   '<label>Password<input type="password" name="pw" required autocomplete="current-password"></label>'+
   '<button>Log in</button>'+
   '<p style="margin-bottom:0"><small>Students: your username and password are given by the school\'s election administrator.</small></p>'+
   '</form>'+ann);
  var u=document.querySelector('#lf input[name=id]');if(u)u.focus();
 });
}

window.onPost=function(j){
 if(j.go){if(j.flash)flash(j.flash[0],j.flash[1]);go(j.go);return;}
 if(j.error){flash('err',j.error);render();return;}
 render();
};
render();
