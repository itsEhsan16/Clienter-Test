export default function Rupee({
  className = '',
  size = 16,
}: {
  className?: string
  size?: number
}) {
  return (
    <span
      aria-hidden
      className={`${className} inline-flex items-center justify-center font-semibold`}
      style={{ fontSize: size }}
    >
      ₹
    </span>
  )
}
