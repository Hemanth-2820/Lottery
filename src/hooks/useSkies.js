import { useEffect } from 'react'

// One small WebGL shader paints every sky: M = mood (0 noon, 1 backwater, 2 sunset, 3 night),
// V = (cloud seed, sun height), A = card aspect ratio, T = time.
const FS = `precision highp float;uniform vec2 R;uniform float T,M,A;uniform vec2 V;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*ns(p);p=p*2.03+vec2(17.3,9.1);a*=.5;}return s;}
float sq(float x){return x*x;}
float sel(float a,float b,float c,float d){return M<.5?a:M<1.5?b:M<2.5?c:d;}
vec3 sel3(vec3 a,vec3 b,vec3 c,vec3 d){return M<.5?a:M<1.5?b:M<2.5?c:d;}
vec3 scene(vec2 uv,float asp,float hy,vec2 sun,float soft){
 float t=clamp((uv.y-hy)/(1.-hy),0.,1.);
 vec3 zen=sel3(vec3(.06,.30,.84),vec3(.06,.42,.80),vec3(.20,.10,.46),vec3(.01,.02,.09));
 vec3 hor=sel3(vec3(.50,.78,1.),vec3(.62,.92,.90),vec3(1.,.46,.12),vec3(.08,.13,.40));
 vec3 col=mix(hor,zen,pow(t,.65));
 if(M>1.5&&M<2.5)col=mix(col,vec3(.98,.30,.52),exp(-sq((t-.3)*3.6))*.65);
 vec3 sc=sel3(vec3(1.,.98,.92),vec3(1.,.97,.86),vec3(1.,.72,.36),vec3(.92,.95,1.));
 vec2 dv=(uv-sun)*vec2(asp,1.);float d=length(dv);float rad=sel(.085,.07,.115,.1);
 float c=fbm(vec2(uv.x*asp*sel(2.2,2.6,2.,2.4)+T*sel(.02,.015,.012,.008),uv.y*sel(4.,5.,6.,5.))+M*7.+V.x);
 float cd=smoothstep(sel(.52,.56,.52,.6),sel(.78,.86,.82,.9),c)*smoothstep(0.,.25,t);
 vec3 cl=mix(sel3(vec3(.72,.8,.94),vec3(.8,.9,.95),vec3(.45,.2,.45),vec3(.05,.07,.18)),sel3(vec3(1.),vec3(1.),vec3(1.,.62,.42),vec3(.3,.35,.55)),clamp(c*1.4-.4+exp(-d*3.)*.6,0.,1.));
 if(M>2.5){vec2 g=uv*vec2(asp,1.)*46.;vec2 id=floor(g);float h=h21(id);vec2 f=fract(g)-.5-(vec2(h21(id+3.),h21(id+7.))-.5)*.6;float st=smoothstep(.09,0.,length(f))*step(.86,h)*(.6+.4*sin(T*3.+h*40.));col+=vec3(st)*(1.-cd)*step(hy,uv.y);}
 float disc=smoothstep(rad,rad-.008-soft,d);
 vec3 body=sc*sel(3.2,2.8,2.4,1.5);
 if(M>2.5){float cr=fbm(dv*38.+3.);body*=.62+.5*cr;body*=smoothstep(-.9,.5,(dv.x*.9+dv.y*.45)/rad);}
 col+=sc*(exp(-d*sel(5.,6.,3.2,7.))*sel(.6,.45,1.15,.32)+exp(-d*22.)*.6);
 col=mix(col,body,disc);
 col=mix(col,cl,cd*sel(.92,.8,.78,.7)*(1.-disc*.6));
 return col;}
void main(){vec2 uv=gl_FragCoord.xy/R;float asp=A;
 float hy=sel(-.001,.40,.36,.38);vec2 sun=vec2(.76,sel(.66,.76,.45,.70)+V.y);vec3 col;
 if(uv.y>hy){col=scene(uv,asp,hy,sun,0.);
  if(M>.5&&M<1.5){float hh=hy+.035+.05*fbm(vec2(uv.x*asp*2.5,2.))+.03*ns(vec2(uv.x*asp*26.,5.));if(uv.y<hh)col=mix(vec3(.04,.24,.13),col,.16);}}
 else{float dp=(hy-uv.y)/hy;float w=fbm(vec2(uv.x*asp*7./(dp+.18)+T*.15,34.*sqrt(dp)-T*.5));
  vec2 ruv=vec2(uv.x+(w-.5)*.07*dp,hy+(hy-uv.y)*(1.+(w-.5)*1.3)+.004);
  col=scene(ruv,asp,hy,sun,.03);
  vec3 tint=sel3(vec3(0.),vec3(.02,.30,.34),vec3(.20,.06,.30),vec3(.01,.03,.12));
  col=mix(col,tint,.2+.22*dp)*mix(.95,.72,dp);
  if(M>.5&&M<1.5)col=mix(col,vec3(.03,.2,.13),smoothstep(.22,0.,dp)*.55);
  vec3 sc=sel3(vec3(1.),vec3(1.,.97,.86),vec3(1.,.75,.4),vec3(.9,.94,1.));
  float gg=pow(ns(vec2(uv.x*asp*46./(dp+.25),uv.y*260.-T*2.5)),7.)*exp(-sq((uv.x-sun.x)*asp*(5.-2.5*dp)));
  col+=sc*gg*sel(0.,1.2,3.,1.6);}
 col=1.-exp(-col*1.7);float lu=dot(col,vec3(.3,.59,.11));col=clamp(mix(vec3(lu),col,1.45),0.,1.);col=col*col*(3.-2.*col)*.35+col*.65;gl_FragColor=vec4(col,1.);}`

// Paints all <canvas class="sky"> elements of the visible screen about 24 times a second.
export default function useSkies(stRef) {
  useEffect(() => {
    let raf, gl
    try {
      const gc = document.createElement('canvas')
      gl = gc.getContext('webgl', { antialias: false, preserveDrawingBuffer: true })
      if (!gl) return
      const mk = (ty, src) => { const sh = gl.createShader(ty); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh }
      const pr = gl.createProgram()
      gl.attachShader(pr, mk(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'))
      gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr)
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      const lp = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0)
      const W = 320, H = 222; gc.width = W; gc.height = H; gl.viewport(0, 0, W, H)
      gl.uniform2f(gl.getUniformLocation(pr, 'R'), W, H)
      const uT = gl.getUniformLocation(pr, 'T'), uM = gl.getUniformLocation(pr, 'M'), uV = gl.getUniformLocation(pr, 'V'), uA = gl.getUniformLocation(pr, 'A')
      let last = -1e9
      const loop = t => {
        raf = requestAnimationFrame(loop)
        const st = stRef.current
        if (document.hidden || st === 'res' || t - last < 100) return
        last = t
        document.querySelectorAll(st === 'home' ? '#strip canvas.sky' : '#psky').forEach(cv => {
          if (cv.width !== W) { cv.width = W; cv.height = H }
          gl.uniform1f(uM, +cv.dataset.m); gl.uniform2f(uV, +cv.dataset.v || 0, +cv.dataset.e || 0)
          gl.uniform1f(uA, (cv.clientWidth || 175) / (cv.clientHeight || 122)); gl.uniform1f(uT, t / 1000)
          gl.drawArrays(gl.TRIANGLES, 0, 3); cv.getContext('2d').drawImage(gc, 0, 0); cv.classList.add('on')
        })
      }
      raf = requestAnimationFrame(loop)
    } catch (e) { console.warn('sky shader unavailable', e) }
    return () => cancelAnimationFrame(raf)
  }, [stRef])
}