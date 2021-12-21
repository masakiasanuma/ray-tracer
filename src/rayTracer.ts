function lessEpsilon(num: number){ 
    return Math.abs(num) < 1e-10; 
} 
function greaterEpsilon(num: number){ 
    return Math.abs(num) > 1e-10; 
} 
  
// classes from the Typescript RayTracer sample
export class Vector {
    constructor(public x: number,
                public y: number,
                public z: number) {
    }
    static times(k: number, v: Vector) { return new Vector(k * v.x, k * v.y, k * v.z); }
    static minus(v1: Vector, v2: Vector) { return new Vector(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z); }
    static plus(v1: Vector, v2: Vector) { return new Vector(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z); }
    static dot(v1: Vector, v2: Vector) { return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z; }
    static mag(v: Vector) { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); }
    static norm(v: Vector) {
        var mag = Vector.mag(v);
        var div = (mag === 0) ? Infinity : 1.0 / mag;
        return Vector.times(div, v);
    }
    static cross(v1: Vector, v2: Vector) {
        return new Vector(v1.y * v2.z - v1.z * v2.y,
                          v1.z * v2.x - v1.x * v2.z,
                          v1.x * v2.y - v1.y * v2.x);
    }
}

export class Color {
    constructor(public r: number,
                public g: number,
                public b: number) {
    }
    static scale(k: number, v: Color) { return new Color(k * v.r, k * v.g, k * v.b); }
    static plus(v1: Color, v2: Color) { return new Color(v1.r + v2.r, v1.g + v2.g, v1.b + v2.b); }
    static times(v1: Color, v2: Color) { return new Color(v1.r * v2.r, v1.g * v2.g, v1.b * v2.b); }
    static white = new Color(1.0, 1.0, 1.0);
    static grey = new Color(0.5, 0.5, 0.5);
    static black = new Color(0.0, 0.0, 0.0);
    static lightness(c: Color) { return Math.sqrt(c.r * c.r + c.g * c.g + c.b * c.b); }
    static toDrawingColor(c: Color) {
        var legalize = (d: number) => d > 1 ? 1 : d;
        return {
            r: Math.floor(legalize(c.r) * 255),
            g: Math.floor(legalize(c.g) * 255),
            b: Math.floor(legalize(c.b) * 255)
        }
    }
}

// Sphere object structure
interface Sphere {
    x: number;
    y: number;
    z: number;
    radius: number;
    dr: number;
    dg: number;
    db: number;
    k_ambient: number;
    k_specular: number;
    specular_power: number;
}

interface Disk {
    x: number;
    y: number;
    z: number;
    radius: number;
    nx: number;
    ny: number;
    nz: number; 
    dr: number;
    dg: number;
    db: number;
    k_ambient: number;
    k_specular: number;
    specular_power: number;
    vx?: number;
    vy?: number;
    vz?: number;
}

// Camera object structure
interface Camera {
    x1: number;
    y1: number;
    z1: number;
    x2: number;
    y2: number;
    z2: number;
    x3: number;
    y3: number;
    z3: number;
}

// Light object structure
interface Light {
    color: Color;
    x: number;
    y: number;
    z: number;
}

// Area Light Object Structure
interface AreaLight {
    r: number;
    g: number;
    b: number;
    x: number;
    y: number;
    z: number;
    ux: number;
    uy: number;
    uz: number;
    vx: number;
    vy: number;
    vz: number;
}

interface Ray {
    start: Vector;
    dir: Vector;
}

// a suggested interface for jitter samples
interface Sample {
    s: number,
    t: number
}

// A class for our application state and functionality
class RayTracer {
    // the constructor paramater "canv" is automatically created 
    // as a property because the parameter is marked "public" in the 
    // constructor parameter
    // canv: HTMLCanvasElement
    //
    // rendering context for the canvas, also public
    // ctx: CanvasRenderingContext2D

    // initial color we'll use for the canvas
    canvasColor = "lightyellow"

    canv: HTMLCanvasElement
    ctx: CanvasRenderingContext2D 

    // List of Scene Objects
    sphereList = [] as Sphere[];
    diskList = [] as Disk[];
    rayList = [] as Ray[];
    lightList = [] as AreaLight[];

    // Ambient Light
    ambientLight: Light = {
        color: new Color(0,0,0),
        x: 0,
        y: 0,
        z: 0,
    };

    // Virtual Camera
    camera: Camera = {
        x1: 0, x2: 0, x3: 0,
        y1: 0, y2: 0, y3: 0,
        z1: 0, z2: 0, z3: 0,
    };

    // FOV
    fov = Math.PI / 2;

    // Background Color
    backgroundColor = new Color(0, 0, 0);

    // some things that will get specified by user method calls
    enableShadows = true
    jitter = false
    samples = 1

    // user method calls set these, for the optional parts of the assignment
    enableBlur = false
    enableReflections = false
    enableDepth = false

    // if you are doing reflection, set some max depth here
    maxDepth = 5;

    constructor (div: HTMLElement,
        public width: number, public height: number, 
        public screenWidth: number, public screenHeight: number) {

        // let's create a canvas and to draw in
        this.canv = document.createElement("canvas");
        this.ctx = this.canv.getContext("2d")!;
        if (!this.ctx) {
            console.warn("our drawing element does not have a 2d drawing context")
            return
        }
        
        div.appendChild(this.canv);

        this.canv.id = "main";
        this.canv.style.width = this.width.toString() + "px";
        this.canv.style.height = this.height.toString() + "px";
        this.canv.width  = this.width;
        this.canv.height = this.height;
    }

    // HINT: SUGGESTED INTERNAL METHOD
    // create an array of samples (size this.samples ^ 2) in the range 0..1, which can
    // be used to create a distriubtion of rays around a single eye ray or light ray.
    // The distribution would use the jitter parameters to create either a regularly spaced or 
    // randomized set of samples.
    private createDistribution(): Sample[] {
        let sampleList = [];
        if (this.jitter) {
            for (let i = 0; i < this.samples; i++) {
                for (let j = 0; j < this.samples; j++) {
                    let newSample: Sample = {
                        s: (i + Math.random()) / this.samples,
                        t: (j + Math.random()) / this.samples,
                    };
                    sampleList.push(newSample)
                }
            }
        } else {
            for (let i = 0; i < this.samples; i++) {
                for (let j = 0; j < this.samples; j++) {
                    let newSample: Sample = {
                        s: (i + 0.5) / this.samples,
                        t: (j + 0.5) / this.samples,
                    };
                    sampleList.push(newSample)
                }
            }
        }
        return sampleList;
    }

    // HINT: SUGGESTED BUT NOT REQUIRED, INTERNAL METHOD
    // like traceRay, but returns on first hit. More efficient than traceRay for detecting if "in shadow"
    private testRay(ray: Ray) {
    }

    // NEW COMMANDS FOR PART B

    // create a new disk 
    // 
    // NOTE:  the final vx, vy, vz are only needed for optional motion blur part, 
    // and are the velocity of the object. The object is moving from x,y,z - vx,vy,vz to x,y,z + vx,vy,vz 
    // during the time interval being rendered.
    new_disk (x: number, y: number, z: number, radius: number, 
              nx: number, ny: number, nz: number, dr: number, dg: number, db: number, 
              k_ambient: number, k_specular: number, specular_pow: number,
              vx?: number, vy?: number, vz?: number) {
        let disk: Disk = {
            x: x, y: y, z: z, radius: radius,
            nx: nx, ny: ny, nz: nz,
            dr: dr, dg: dg, db: db,
            k_ambient: k_ambient, k_specular: k_specular, specular_power: specular_pow,
            vx: vx, vy: vy, vz: vz,
        };
        this.diskList.push(disk);
    }

    // create a new area light source
    area_light (r: number, g: number, b: number, x: number, y: number, z: number, 
                ux: number, uy: number, uz: number, vx: number, vy: number, vz: number) {
        let areaLight: AreaLight = {
            r: r, g: g, b: b,
            x: x, y: y, z: z,
            ux: ux, uy: uy, uz: uz,
            vx: vx, vy: vy, vz: vz,
        };
        this.lightList.push(areaLight);
    }

    set_sample_level (num: number) {
        this.samples = num
    }

    jitter_on() {
        this.jitter = true
    }

    jitter_off() {
        this.jitter = false
    }

    // turn reflection on or off for extra credit reflection part
    reflection_on() {
        this.enableReflections = true
    }

    reflection_off() {
        this.enableReflections = false
    }

    // turn motion blur on or off for extra credit motion blur part
    blur_on() {
        this.enableBlur = true
    }

    blur_off() {
        this.enableBlur = false
    }

    // turn depth of field on or off for extra credit depth of field part
    depth_on() {
        this.enableDepth = true
    }

    depth_off() {
        this.enableDepth = false
    }

    // COMMANDS FROM PART A

    // clear out all scene contents
    reset_scene() {
        this.sphereList = [];
        this.diskList = [];
        this.rayList = [];
        this.lightList = [];
        this.backgroundColor = new Color(0,0,0);
        let newAmbientLight: Light = {
            color: new Color(0,0,0),
            x: 0,
            y: 0,
            z: 0,
        };
        this.ambientLight = newAmbientLight;
        let newCamera: Camera = {
            x1: 0, x2: 0, x3: 0,
            y1: 0, y2: 0, y3: 0,
            z1: 0, z2: 0, z3: 0,
        };
        this.camera = newCamera;
    }

    // create a new point light source
    new_light (r: number, g: number, b: number, x: number, y: number, z: number) {
        let newLight: AreaLight = {
            r: r, g: g, b: b,
            x: x, y: y, z: z,
            ux: 0, uy: 0, uz: 0,
            vx: 0, vy: 0, vz: 0,
        };
        this.lightList.push(newLight);
    }

    // set value of ambient light source
    ambient_light (r: number, g: number, b: number) {
        let newAmbientLight: Light = {
            color: new Color(r,g,b),
            x: 0,
            y: 0,
            z: 0,
        };
        this.ambientLight = newAmbientLight;
    }

    // set the background color for the scene
    set_background (r: number, g: number, b: number) {
        this.backgroundColor = new Color(r, g, b);
    }

    // set the field of view
    DEG2RAD = (Math.PI/180)

    set_fov (theta: number) {
        this.fov = theta * this.DEG2RAD;
    }

    // // set the position of the virtual camera/eye
    // set_eye_position (x: number, y: number, z: number) {
    //     this.scene.camera.pos = new Vector(x,y,z)
    // }

    // set the virtual camera's viewing direction
    set_eye(x1: number, y1: number, z1: number, 
            x2: number, y2: number, z2: number, 
            x3: number, y3: number, z3: number) {
        let eye: Camera = {
            x1: x1, y1: y1, z1: z1,
            x2: x2, y2: y2, z2: z2,
            x3: x3, y3: y3, z3: z3,
        };
        this.camera = eye;
    }

    // create a new sphere.
    //
    // NOTE:  the final vx, vy, vz are only needed for optional motion blur part, 
    // and are the velocity of the object. The object is moving from x,y,z - vx,vy,vz to x,y,z + vx,vy,vz 
    // during the time interval being rendered.

    new_sphere (x: number, y: number, z: number, radius: number, 
                dr: number, dg: number, db: number, 
                k_ambient: number, k_specular: number, specular_pow: number, 
                vx?: number, vy?: number, vz?: number) {
        let newSphere: Sphere = {
            x: x, y: y, z: z, radius: radius,
            dr: dr, dg: dg, db: db,
            k_ambient: k_ambient, k_specular: k_specular, specular_power: specular_pow,
        };
        this.sphereList.push(newSphere);
    }

    // INTERNAL METHODS YOU MUST IMPLEMENT

    // create an eye ray based on the current pixel's position
    private eyeRay(i: number, j: number): Ray {
        let eyePos = new Vector(this.camera.x1, this.camera.y1, this.camera.z1);
        let upDir = new Vector(this.camera.x3, this.camera.y3, this.camera.z3);
        
        // orthnormal basis for the camera
        let w = Vector.norm(new Vector(
            this.camera.x1 - this.camera.x2,
            this.camera.y1 - this.camera.y2,
            this.camera.z1 - this.camera.z2,
        ));
        let u = Vector.norm(Vector.cross(upDir, w));
        let v = Vector.norm(Vector.cross(u, w));

        // Calculate distance
        let distance = 1 / Math.tan(this.fov / 2);

        // Calculate pixel positions
        let us = -1 + ((2 * i) / this.screenWidth);
        let vs = -1 + ((2 * j) / this.screenHeight) * (this.height / this.width);

        // Calculate ray direction
        let rayDir = Vector.norm(new Vector(
            (-distance * w.x) + (us * u.x) + (vs * v.x),
            (-distance * w.y) + (us * u.y) + (vs * v.y),
            (-distance * w.z) + (us * u.z) + (vs * v.z),
        ));

        let ray: Ray = {
            start: eyePos,
            dir: rayDir,
        };

        return ray;
    }

    private traceRay(ray: Ray, depth: number = 0): Color {
        let object = null;
        let minT = Number.POSITIVE_INFINITY;
        let hitPoint = new Vector(0,0,0);
        let n = null;

        // For each sphere in the list
        for (let i = 0; i < this.sphereList.length; i++) {
            // Calculate the time where the ray intersects the sphere
            let tSphere = this.sphereIntersect(ray, this.sphereList[i]);

            // if t is the smallest t so far
            if (tSphere && tSphere < minT) {
                // Calculate the point of intersection and select the sphere
                hitPoint = Vector.plus(ray.start, Vector.times(tSphere, ray.dir));
                minT = tSphere;
                object = this.sphereList[i];
                n = Vector.norm(new Vector(
                    hitPoint.x - object.x,
                    hitPoint.y - object.y,
                    hitPoint.z - object.z,
                ));
            }
        }

        // For each disk in the list
        for (let i = 0; i < this.diskList.length; i++) {
            // Calculate the time where the ray intersects the disk
            let tDisk = this.diskIntersect(ray, this.diskList[i]);

            // if t is the smallest t so far
            if (tDisk && tDisk < minT) {
                // Calculate the point of intersection and select the sphere
                hitPoint = Vector.plus(ray.start, Vector.times(tDisk, ray.dir));
                minT = tDisk;
                object = this.diskList[i];
                n = Vector.norm(new Vector(object.nx, object.ny, object.nz));
            }
        }

        if (object && n) {
            // Calculate the rgb illumination for the point
            let color = new Color(
                object.k_ambient * this.ambientLight.color.r * object.dr,
                object.k_ambient * this.ambientLight.color.g * object.dg,
                object.k_ambient * this.ambientLight.color.b * object.db,
            )

            // For each light in the light list
            for (let i = 0; i < this.lightList.length; i++) {
                // Create samples for area light
                let samples = this.createDistribution();

                // Specular contribution for light
                let spec = new Color(0,0,0);

                // Diffuse contribution for light
                let diffuse = new Color(0,0,0);

                // Direction vector from intersection point to eye
                let v = Vector.norm(Vector.minus(ray.start, hitPoint));

                // For each sample in the sample list
                for (let j = 0; j < samples.length; j++) {
                    // Position of the light based on sample
                    let lightPos = new Vector(
                        this.lightList[i].x + (((2 * samples[j].s) - 1) * this.lightList[i].ux) + (((2 * samples[j].t) - 1) * this.lightList[i].vx),
                        this.lightList[i].y + (((2 * samples[j].s) - 1) * this.lightList[i].uy) + (((2 * samples[j].t) - 1) * this.lightList[i].vy),
                        this.lightList[i].z + (((2 * samples[j].s) - 1) * this.lightList[i].uz) + (((2 * samples[j].t) - 1) * this.lightList[i].vz),
                    );

                    // Direction vector from intersection point to light point
                    let l = Vector.norm(Vector.minus(lightPos, hitPoint));

                    // Shift shadow start point to avoid self-intersection
                    let shadowStart = Vector.plus(hitPoint, Vector.times(1e-10, l));

                    // Ray from hit point to the light source
                    let shadowRay: Ray = {
                        start: shadowStart,
                        dir: l,
                    };

                    // Flag for checking if the point is shadowed
                    let shadowFlag = false;

                    // For each sphere, check if shadow ray intersects with sphere
                    for (let j = 0; j < this.sphereList.length; j++) {
                        let shadowIntersect = this.sphereIntersect(shadowRay, this.sphereList[j]);
                        if (shadowIntersect) {
                            shadowFlag = true;
                            break;
                        }
                    }

                    // For each disk, check if shadow ray intersects with disk
                    for (let j = 0; j < this.diskList.length; j++) {
                        let shadowIntersect = this.diskIntersect(shadowRay, this.diskList[j]);
                        if (shadowIntersect) {
                            shadowFlag = true;
                            break;
                        }
                    }

                    // Light reflection vector
                    let lightRef = Vector.norm(new Vector(
                        (2 * Vector.dot(l, n) * n.x) - l.x,
                        (2 * Vector.dot(l, n) * n.y) - l.y,
                        (2 * Vector.dot(l, n) * n.z) - l.z,
                    ));

                    // Calculate summation for the illumination
                    if (!shadowFlag) {
                        diffuse = new Color(
                            diffuse.r + object.dr * this.lightList[i].r * Math.max(0, Vector.dot(n, l)),
                            diffuse.g + object.dg * this.lightList[i].g * Math.max(0, Vector.dot(n, l)),
                            diffuse.b + object.db * this.lightList[i].b * Math.max(0, Vector.dot(n, l)),
                        )
                        spec = new Color(
                            Math.max(spec.r, object.k_specular * Math.pow(Math.max(0, Vector.dot(lightRef, v)), object.specular_power)),
                            Math.max(spec.g, object.k_specular * Math.pow(Math.max(0, Vector.dot(lightRef, v)), object.specular_power)),
                            Math.max(spec.b, object.k_specular * Math.pow(Math.max(0, Vector.dot(lightRef, v)), object.specular_power)),
                        )
                    }
                }
                color = new Color(
                    color.r + (diffuse.r / samples.length) + spec.r,
                    color.g + (diffuse.g / samples.length) + spec.g,
                    color.b + (diffuse.b / samples.length) + spec.b,
                )
            }

            // If reflection is enable
            if (this.enableReflections && (depth < this.maxDepth)) {
                // Calculate reflection vector based on normal and ray direction
                let reflectVec = Vector.norm(Vector.minus(ray.dir, Vector.times(Vector.dot(ray.dir, n) * 2, n)));
                let reflectRay: Ray = {
                    start: Vector.plus(hitPoint, Vector.times(1e-10, reflectVec)),
                    dir: reflectVec,
                };
                // Recurse until maximum depth
                return Color.plus(color, Color.scale(object.k_specular, this.traceRay(reflectRay, depth + 1)));
            }

            return color;
        } else {
            // Return background color if the ray does not intersect with a sphere
            return this.backgroundColor;
        }
    }

    // Helper function for calculating intersection betweem ray and sphere
    private sphereIntersect(ray: Ray, sphere: Sphere) {
        // Calculate a,b,c based on sphere formula
        let a = Vector.dot(ray.dir, ray.dir);
        let e_c = new Vector(
            ray.start.x - sphere.x,
            ray.start.y - sphere.y,
            ray.start.z - sphere.z,
        );
        let b = 2 * Vector.dot(ray.dir, e_c);
        let c = Vector.dot(e_c, e_c) - Math.pow(sphere.radius, 2);
        let discriminant = Math.pow(b, 2) - (4 * a * c);
        let t1 = 0;
        let t2 = 0;
        // Determine number of intersection points based on discrimnant
        if (discriminant < 0) {
            return null;
        } else if (discriminant > 0) {
            t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
            t2 = (-b - Math.sqrt(discriminant)) / (2 * a);

            // Check various intersection scenarios
            if (t1 < 0 && t2 < 0) { // Both t negative, no intersection
                return null;
            } else if (t2 < 0 || t2 < 0) {
                return Math.max(t1, t2);
            }

            // Choose closest point if two solutions
            return Math.min(t1, t2);
        } else {
            t1 = -b / (2 * a);
            // No intersection if t is negative
            if (t1 < 0) {
                return null;
            }
            return t1;
        }
    }

    private diskIntersect(ray: Ray, disk: Disk) {
        let diskNormal = new Vector(disk.nx, disk.ny, disk.nz);
        let t = null
        let intersectVec = new Vector(
            disk.x - ray.start.x,
            disk.y - ray.start.y,
            disk.z - ray.start.z,
        );
        if (greaterEpsilon(Vector.dot(ray.dir, diskNormal))) {
            t = Vector.dot(intersectVec, diskNormal) / Vector.dot(ray.dir, diskNormal);
            let p = Vector.plus(ray.start, Vector.times(t, ray.dir));
            let p_c = new Vector(
                p.x - disk.x,
                p.y - disk.y,
                p.z - disk.z,
            );
            let check = Vector.dot(p_c, p_c);
            if (check <= Math.pow(disk.radius, 2) && t > 0) {
                return t;
            }
        }
        return null;
    }

    // draw_scene is provided to create the image from the ray traced colors. 
    // 1. it renders 1 line at a time, and uses requestAnimationFrame(render) to schedule 
    //    the next line.  This causes the lines to be displayed as they are rendered.
    // 2. it uses the additional constructor parameters to allow it to render a  
    //    smaller # of pixels than the size of the canvas
    //
    // YOU WILL NEED TO MODIFY draw_scene TO IMPLEMENT DISTRIBUTION RAY TRACING!
    //
    // NOTE: this method now has three optional parameters that are used for the depth of
    // field extra credit part. You will use these to modify this routine to adjust the
    // eyeRays to create the depth of field effect.
    draw_scene(lensSize?: number, depth1?: number, depth2?: number) {

        // rather than doing a for loop for y, we're going to draw each line in
        // an animationRequestFrame callback, so we see them update 1 by 1
        var pixelWidth = this.width / this.screenWidth;
        var pixelHeight = this.height / this.screenHeight;
        var y = 0;
        
        this.clear_screen();

        var renderRow = () => {
            for (var x = 0; x < this.screenWidth; x++) {
                // HINT: if you implemented "createDistribution()" above, you can use it here
                let vecs = this.createDistribution();

                // HINT: you will need to loop through all the rays, if distribution is turned
                // on, and compute an average color for each pixel.
                let colorSum = new Color(0,0,0);
                for (let i = 0; i < vecs.length; i++) {
                    let color = this.traceRay(this.eyeRay(x + vecs[i].s, y + vecs[i].t));
                    colorSum = Color.plus(colorSum, color);
                }
                let c = Color.scale(1 / vecs.length, colorSum);

                var color = Color.toDrawingColor(c)
                this.ctx.fillStyle = "rgb(" + String(color.r) + ", " + String(color.g) + ", " + String(color.b) + ")";
                this.ctx.fillRect(x * pixelWidth, y * pixelHeight, pixelWidth+1, pixelHeight+1);
            }
            
            // finished the row, so increment row # and see if we are done
            y++;
            if (y < this.screenHeight) {
                // finished a line, do another
                requestAnimationFrame(renderRow);            
            } else {
                console.log("Finished rendering scene")
            }
        }

        renderRow();
    }

    clear_screen() {
        this.ctx.fillStyle = this.canvasColor;
        this.ctx.fillRect(0, 0, this.canv.width, this.canv.height);

    }
}
export {RayTracer}