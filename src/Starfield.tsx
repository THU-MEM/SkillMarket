import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  previousX: number
  previousY: number
  velocityX: number
  velocityY: number
  directionX: number
  directionY: number
  speed: number
  color: readonly [number, number, number]
}

const colors = [
  [255, 255, 255],
  [255, 255, 255],
  [226, 190, 235],
  [190, 142, 207],
  [169, 111, 188],
] as const

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    const context = canvas?.getContext('2d')
    if (!canvas || !host || !context) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0
    let height = 0
    let originX = 0
    let originY = 0
    let maximumRadius = 0
    let stars: Star[] = []
    let frame = 0
    let previousTime = 0

    const random = (minimum: number, maximum: number) =>
      Math.random() * (maximum - minimum) + minimum

    const createStar = (): Star => {
      const angle = random(0, Math.PI * 2)
      const radius = random(38, Math.max(42, maximumRadius))
      const heading = angle + 0.16
      const x = originX + Math.cos(angle) * radius
      const y = originY + Math.sin(angle) * radius
      return {
        x,
        y,
        previousX: x,
        previousY: y,
        velocityX: 0,
        velocityY: 0,
        directionX: Math.cos(heading),
        directionY: Math.sin(heading),
        speed: random(0.5, 1.45),
        color: colors[Math.floor(Math.random() * colors.length)],
      }
    }

    const seed = () => {
      const count = reducedMotion.matches ? 55 : Math.min(150, Math.max(85, Math.round(width / 9)))
      stars = Array.from({ length: count }, createStar)
    }

    const measure = () => {
      const bounds = host.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = bounds.width
      height = bounds.height
      originX = width * 0.72
      originY = height * 0.46
      maximumRadius = Math.hypot(width, height) * 0.45
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)
      seed()
    }

    const drawStaticField = () => {
      context.clearRect(0, 0, width, height)
      for (const star of stars) {
        const [red, green, blue] = star.color
        context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${random(0.25, 0.72)})`
        context.beginPath()
        context.arc(star.x, star.y, random(0.45, 1.25), 0, Math.PI * 2)
        context.fill()
      }
    }

    const respawn = (star: Star) => Object.assign(star, createStar())

    const animate = (timestamp: number) => {
      frame = window.requestAnimationFrame(animate)
      if (!previousTime) {
        previousTime = timestamp
        return
      }

      const delta = Math.min((timestamp - previousTime) / (1000 / 60), 3)
      previousTime = timestamp
      context.globalCompositeOperation = 'destination-out'
      context.fillStyle = 'rgba(0, 0, 0, 0.19)'
      context.fillRect(0, 0, width, height)
      context.globalCompositeOperation = 'source-over'

      for (const star of stars) {
        const pull = 0.0042 * star.speed * delta
        star.velocityX += star.directionX * pull
        star.velocityY += star.directionY * pull
        star.previousX = star.x
        star.previousY = star.y
        star.x += star.velocityX * delta
        star.y += star.velocityY * delta

        const velocity = Math.hypot(star.velocityX, star.velocityY)
        const [red, green, blue] = star.color
        context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${Math.min(velocity / 2.1, 0.72)})`
        context.lineWidth = Math.min(0.45 + velocity * 0.4, 1.55)
        context.beginPath()
        context.moveTo(star.previousX, star.previousY)
        context.lineTo(star.x, star.y)
        context.stroke()

        if (star.x < -4 || star.x > width + 4 || star.y < -4 || star.y > height + 4) {
          respawn(star)
        }
      }
    }

    const stop = () => {
      window.cancelAnimationFrame(frame)
      frame = 0
      previousTime = 0
    }

    const start = () => {
      stop()
      if (reducedMotion.matches) drawStaticField()
      else frame = window.requestAnimationFrame(animate)
    }

    const resizeObserver = new ResizeObserver(() => {
      measure()
      start()
    })
    const handleVisibility = () => {
      if (document.hidden) stop()
      else start()
    }
    const handleMotionChange = () => {
      measure()
      start()
    }

    measure()
    start()
    resizeObserver.observe(host)
    document.addEventListener('visibilitychange', handleVisibility)
    reducedMotion.addEventListener('change', handleMotionChange)

    return () => {
      stop()
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      reducedMotion.removeEventListener('change', handleMotionChange)
    }
  }, [])

  return <canvas ref={canvasRef} className="starfield-canvas" aria-hidden="true" />
}
