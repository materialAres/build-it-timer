/**
 * Whether this browser can start the 3D view (CR6.T8b): three.js needs WebGL2.
 * The probe context is released at once so it does not count against the page's
 * limit of live contexts. Never throws; "cannot tell" means "no".
 */
export function hasWebGl2(doc: Document = document): boolean {
  try {
    const gl = doc.createElement('canvas').getContext('webgl2');
    if (gl === null) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
