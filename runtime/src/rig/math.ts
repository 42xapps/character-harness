// The little 3D math the retargeter needs. Quaternions are [x, y, z, w] and
// matrices are column-major 4x4, both as glTF stores them.

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type Mat4 = number[];

export const IDENTITY_Q: Quat = [0, 0, 0, 1];

export function qmul(a: Quat, b: Quat): Quat {
	return [
		a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
		a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
		a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
		a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
	];
}

export function qnorm(q: Quat): Quat {
	const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
	return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

// the inverse of a unit quaternion
export function qinv(q: Quat): Quat {
	return [-q[0], -q[1], -q[2], q[3]];
}

export function qslerp(a: Quat, b: Quat, t: number): Quat {
	let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
	const s: Quat = d < 0 ? [-b[0], -b[1], -b[2], -b[3]] : [...b];
	d = Math.abs(d);
	if (d > 0.9995) return qnorm([a[0] + (s[0] - a[0]) * t, a[1] + (s[1] - a[1]) * t, a[2] + (s[2] - a[2]) * t, a[3] + (s[3] - a[3]) * t]);
	const th = Math.acos(d);
	const sa = Math.sin((1 - t) * th) / Math.sin(th);
	const sb = Math.sin(t * th) / Math.sin(th);
	return [a[0] * sa + s[0] * sb, a[1] * sa + s[1] * sb, a[2] * sa + s[2] * sb, a[3] * sa + s[3] * sb];
}

// rotation of `deg` degrees about a unit axis
export function qaxis(axis: Vec3, deg: number): Quat {
	const h = (deg * Math.PI) / 360;
	const s = Math.sin(h);
	return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(h)];
}

export function compose(t: Vec3, r: Quat, s: Vec3): Mat4 {
	const [x, y, z, w] = r;
	const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
	return [
		(1 - 2 * (yy + zz)) * s[0], 2 * (xy + wz) * s[0], 2 * (xz - wy) * s[0], 0,
		2 * (xy - wz) * s[1], (1 - 2 * (xx + zz)) * s[1], 2 * (yz + wx) * s[1], 0,
		2 * (xz + wy) * s[2], 2 * (yz - wx) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
		t[0], t[1], t[2], 1,
	];
}

// translation, rotation and scale of an affine matrix without shear
export function decompose(m: Mat4): { t: Vec3; r: Quat; s: Vec3 } {
	const sx = Math.hypot(m[0], m[1], m[2]);
	const sy = Math.hypot(m[4], m[5], m[6]);
	const sz = Math.hypot(m[8], m[9], m[10]);
	const r00 = m[0] / sx, r10 = m[1] / sx, r20 = m[2] / sx;
	const r01 = m[4] / sy, r11 = m[5] / sy, r21 = m[6] / sy;
	const r02 = m[8] / sz, r12 = m[9] / sz, r22 = m[10] / sz;
	const tr = r00 + r11 + r22;
	let q: Quat;
	if (tr > 0) {
		const s = Math.sqrt(tr + 1) * 2;
		q = [(r21 - r12) / s, (r02 - r20) / s, (r10 - r01) / s, s / 4];
	} else if (r00 > r11 && r00 > r22) {
		const s = Math.sqrt(1 + r00 - r11 - r22) * 2;
		q = [s / 4, (r01 + r10) / s, (r02 + r20) / s, (r21 - r12) / s];
	} else if (r11 > r22) {
		const s = Math.sqrt(1 + r11 - r00 - r22) * 2;
		q = [(r01 + r10) / s, s / 4, (r12 + r21) / s, (r02 - r20) / s];
	} else {
		const s = Math.sqrt(1 + r22 - r00 - r11) * 2;
		q = [(r02 + r20) / s, (r12 + r21) / s, s / 4, (r10 - r01) / s];
	}
	return { t: [m[12], m[13], m[14]], r: qnorm(q), s: [sx, sy, sz] };
}

export function mmul(a: Mat4, b: Mat4): Mat4 {
	const o = new Array(16).fill(0);
	for (let c = 0; c < 4; c++)
		for (let r = 0; r < 4; r++)
			for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
	return o;
}

// inverse of an affine matrix
export function minv(m: Mat4): Mat4 {
	const [a, b, c, , d, e, f, , g, h, i] = m;
	const det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
	const id = 1 / det;
	const r = [
		(e * i - f * h) * id, (c * h - b * i) * id, (b * f - c * e) * id,
		(f * g - d * i) * id, (a * i - c * g) * id, (c * d - a * f) * id,
		(d * h - e * g) * id, (b * g - a * h) * id, (a * e - b * d) * id,
	];
	const t = [m[12], m[13], m[14]];
	return [
		r[0], r[1], r[2], 0,
		r[3], r[4], r[5], 0,
		r[6], r[7], r[8], 0,
		-(r[0] * t[0] + r[3] * t[1] + r[6] * t[2]),
		-(r[1] * t[0] + r[4] * t[1] + r[7] * t[2]),
		-(r[2] * t[0] + r[5] * t[1] + r[8] * t[2]),
		1,
	];
}

export function mpoint(m: Mat4, p: Vec3): Vec3 {
	return [
		m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
		m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
		m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
	];
}
