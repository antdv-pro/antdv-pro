const bubble = {
  width: 0,
  height: 0,
  canvas: null,
  ctx: null,
  circles: [],
  animate: true,
  requestId: null,
}
export const init = function (canvasInstance) {
  if (!bubble || !canvasInstance)
    throw new Error('no canvasInstance')
  bubble.width = window.innerWidth
  bubble.height = window.innerHeight
  bubble.canvas = canvasInstance
  bubble.canvas.width = bubble.width
  bubble.canvas.height = bubble.height
  bubble.ctx = bubble.canvas.getContext('2d')
  bubble.circles = []
  for (let x = 0; x < bubble.width * 0.5; x++) {
    const c = new Circle()
    bubble.circles.push(c)
  }
  animate()
  addListeners()
}
function scrollCheck() {
  bubble.animate = !(document.body.scrollTop > bubble.height)
}
function resize() {
  bubble.width = window.innerWidth
  bubble.height = window.innerHeight
  bubble.canvas.width = bubble.width
  bubble.canvas.height = bubble.height
}
function animate() {
  if (bubble.animate) {
    bubble.ctx.clearRect(0, 0, bubble.width, bubble.height)
    for (const i in bubble.circles)
      bubble.circles[i].draw()
  }
  bubble.requestId = requestAnimationFrame(animate)
}
class Circle {
  pos
  alpha
  scale
  velocity
  draw
  constructor() {
    this.pos = {
      x: Math.random() * bubble.width,
      y: bubble.height + Math.random() * 100,
    }
    this.alpha = 0.1 + Math.random() * 0.3
    this.scale = 0.1 + Math.random() * 0.3
    this.velocity = Math.random()
    const r = Math.random() * 255
    const g = Math.random() * 255
    const b = Math.random() * 255
    this.draw = function () {
      this.pos.y -= this.velocity
      this.alpha -= 5e-4
      bubble.ctx.beginPath()
      bubble.ctx.arc(
        this.pos.x,
        this.pos.y,
        this.scale * 10,
        0,
        2 * Math.PI,
        false,
      )
      bubble.ctx.fillStyle = `rgba(${r},${g},${b},${this.alpha})`
      bubble.ctx.fill()
    }
  }
}
function addListeners() {
  window.addEventListener('scroll', scrollCheck)
  window.addEventListener('resize', resize)
}
export function removeListeners() {
  window.removeEventListener('scroll', scrollCheck)
  window.removeEventListener('resize', resize)
  cancelAnimationFrame(bubble.requestId)
}
export default {
  init,
  removeListeners,
}
