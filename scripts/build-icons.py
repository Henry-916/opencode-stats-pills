"""Build the original four-glyph StatsPills icon font (requires fonttools)."""
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

def circular_arc(pen,x,y,r,start,end,width):
    # One continuous outline avoids seams from overlapping stroke segments.
    def point(cx,cy,radius,angle):
        angle*=pi/180
        return (round(cx+radius*cos(angle)),round(cy+radius*sin(angle)))
    count=max(32,round(abs(end-start)))
    angles=[start+(end-start)*i/count for i in range(count+1)]
    half=width/2
    points=[point(x,y,r+half,a) for a in angles]
    ex,ey=point(x,y,r,end)
    points += [point(ex,ey,half,end+180*i/24) for i in range(1,25)]
    points += [point(x,y,r-half,a) for a in reversed(angles[:-1])]
    sx,sy=point(x,y,r,start)
    points += [point(sx,sy,half,start+180+180*i/24) for i in range(1,25)]
    polygon(pen,points)

glyphs={'.notdef':TTGlyphPen(None).glyph(),'space':TTGlyphPen(None).glyph()}
p=TTGlyphPen(None)
circular_arc(p,600,610,440,-35,215,76)
stroke(p,(600,610),(835,845),76);disc(p,600,610,66)
glyphs['gauge']=p.glyph()
p=TTGlyphPen(None)
arc(p,600,1020,425,130,0,360,84)
stroke(p,(175,1020),(175,240),84);stroke(p,(1025,1020),(1025,240),84)
arc(p,600,630,425,130,180,360,84);arc(p,600,240,425,130,180,360,84)
glyphs['database']=p.glyph()
p=TTGlyphPen(None)
arc(p,600,610,435,435,0,360,84);disc(p,600,1045,78)
glyphs['context']=p.glyph()
p=TTGlyphPen(None)
# Rounded wallet, with a single clasp and no embedded currency lettering.
arc(p,280,900,100,100,90,180,76)
arc(p,920,900,100,100,0,90,76)
arc(p,280,300,100,100,180,270,76)
arc(p,920,300,100,100,270,360,76)
for start,end in [((280,1000),(920,1000)),((180,300),(180,900)),
                  ((280,200),(920,200)),((1020,740),(1020,900)),
                  ((1020,300),(1020,500)),((820,740),(1060,740)),
                  ((1060,500),(1060,740)),((820,500),(1060,500))]:
    stroke(p,start,end,76)
arc(p,820,620,120,120,90,270,76)
disc(p,820,620,38)
glyphs['wallet']=p.glyph()
# Enlarge the actual outlines, keeping the same em, advance and line metrics.
# Preserve the visual center; surrounding spaces accommodate wider outlines.
for name in ('gauge','database','context','wallet'):
    glyph=glyphs[name]
    glyph.recalcBounds(glyphs)
    # Match visible height rather than the em box: Cascadia Mono digits are
    # about 1460 units high. 1800 units puts icons roughly 23% above that.
    scale=1800/(glyph.yMax-glyph.yMin)
    center_x=(glyph.xMin+glyph.xMax)/2
    center_y=(glyph.yMin+glyph.yMax)/2
    target=TTGlyphPen(None)
    glyph.draw(TransformPen(target,(scale,0,0,scale,600-center_x*scale,704-center_y*scale)),None)
    glyphs[name]=target.glyph()
# Split the wide gauge across two terminal cells. Each half stays inside
# its own advance, so Windows Terminal cannot recolor an overhanging outline.
gauge=glyphs['gauge']
coordinates,endpoints,_=gauge.getCoordinates(glyphs)
contours=[]
first=0
for last in endpoints:
    contours.append([(x+600,y) for x,y in coordinates[first:last+1]])
    first=last+1

def clip_x(points,bound,keep_right):
    result=[]
    previous=points[-1]
    previous_inside=previous[0]>=bound if keep_right else previous[0]<=bound
    for current in points:
        inside=current[0]>=bound if keep_right else current[0]<=bound
        if inside!=previous_inside:
            ratio=(bound-previous[0])/(current[0]-previous[0])
            result.append((bound,previous[1]+ratio*(current[1]-previous[1])))
        if inside:result.append(current)
        previous,previous_inside=current,inside
    return result

for name,left in [('gauge',0),('gauge_right',1200)]:
    pen=TTGlyphPen(None)
    for contour in contours:
        points=clip_x(contour,left,True)
        if points:points=clip_x(points,left+1200,False)
        if len(points)>=3:polygon(pen,[(round(x-left),round(y)) for x,y in points])
    glyphs[name]=pen.glyph()
fb=FontBuilder(2048,isTTF=True)
fb.setupGlyphOrder(list(glyphs));fb.setupCharacterMap({32:'space',0xE900:'gauge',0xE901:'database',0xE902:'context',0xE903:'wallet',0xE904:'gauge_right'})
fb.setupGlyf(glyphs);fb.setupHorizontalMetrics({name:(1200,getattr(glyph,'xMin',0)) for name,glyph in glyphs.items()})
fb.setupHorizontalHeader(ascent=1900,descent=-480)
fb.setupNameTable({'familyName':'StatsPills Icons Large v1.7','styleName':'Regular','uniqueFontIdentifier':'StatsPills Icons 1.7','fullName':'StatsPills Icons Large v1.7','psName':'StatsPillsIconsLargeV17','version':'Version 1.7'})
fb.setupOS2(sTypoAscender=1900,sTypoDescender=-480,usWinAscent=1900,usWinDescent=480)
fb.setupPost(isFixedPitch=1);fb.setupMaxp();fb.save(OUT/'StatsPillsIcons.ttf')
print('Built StatsPillsIcons.ttf')
