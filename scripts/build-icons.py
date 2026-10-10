"""Build the original three-glyph StatsPills icon font (requires fonttools)."""
from pathlib import Path
from math import sin, cos, pi, hypot
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'assets';OUT.mkdir(exist_ok=True)

def polygon(pen,points):
    pen.moveTo(points[0])
    for p in points[1:]:pen.lineTo(p)
    pen.closePath()
def disc(pen,x,y,r):
    polygon(pen,[(round(x+r*cos(i*2*pi/32)),round(y+r*sin(i*2*pi/32))) for i in range(32)])
def stroke(pen,a,b,width):
    dx,dy=b[0]-a[0],b[1]-a[1];length=hypot(dx,dy)
    if length:
        ox,oy=-dy/length*width/2,dx/length*width/2
        polygon(pen,[(round(a[0]-ox),round(a[1]-oy)),(round(b[0]-ox),round(b[1]-oy)),(round(b[0]+ox),round(b[1]+oy)),(round(a[0]+ox),round(a[1]+oy))])
    disc(pen,*a,width/2);disc(pen,*b,width/2)
def arc(pen,x,y,rx,ry,start,end,width):
    count=max(8,round(abs(end-start)/4))
    pts=[(x+rx*cos((start+(end-start)*i/count)*pi/180),y+ry*sin((start+(end-start)*i/count)*pi/180)) for i in range(count+1)]
    for a,b in zip(pts,pts[1:]):stroke(pen,a,b,width)

glyphs={'.notdef':TTGlyphPen(None).glyph(),'space':TTGlyphPen(None).glyph()}
p=TTGlyphPen(None)
arc(p,600,610,440,440,-35,215,76)
stroke(p,(600,610),(835,845),76);disc(p,600,610,66)
glyphs['gauge']=p.glyph()
p=TTGlyphPen(None)
arc(p,600,1020,425,130,0,360,76)
stroke(p,(175,1020),(175,240),76);stroke(p,(1025,1020),(1025,240),76)
arc(p,600,630,425,130,180,360,76);arc(p,600,240,425,130,180,360,76)
glyphs['database']=p.glyph()
p=TTGlyphPen(None)
arc(p,600,610,435,435,0,360,76);disc(p,600,1045,78)
glyphs['context']=p.glyph()
# Enlarge the actual outlines, keeping the same em, advance and line metrics.
# A small symmetric overhang fits the existing spaces around each icon.
for name in ('gauge','database','context'):
    target=TTGlyphPen(None)
    glyphs[name].draw(TransformPen(target,(1.4,0,0,1.4,-240,-150)),None)
    glyphs[name]=target.glyph()
fb=FontBuilder(2048,isTTF=True)
fb.setupGlyphOrder(list(glyphs));fb.setupCharacterMap({32:'space',0xE900:'gauge',0xE901:'database',0xE902:'context'})
fb.setupGlyf(glyphs);fb.setupHorizontalMetrics({name:(1200,getattr(glyph,'xMin',0)) for name,glyph in glyphs.items()})
fb.setupHorizontalHeader(ascent=1900,descent=-480)
fb.setupNameTable({'familyName':'StatsPills Icons Large','styleName':'Regular','uniqueFontIdentifier':'StatsPills Icons 1.1','fullName':'StatsPills Icons Large','psName':'StatsPillsIconsLarge','version':'Version 1.1'})
fb.setupOS2(sTypoAscender=1900,sTypoDescender=-480,usWinAscent=1900,usWinDescent=480)
fb.setupPost(isFixedPitch=1);fb.setupMaxp();fb.save(OUT/'StatsPillsIcons.ttf')
print('Built StatsPillsIcons.ttf')
