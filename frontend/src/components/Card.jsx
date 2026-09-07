function Card({ className = "", children, ...rest }) {
  return (
    <div
      className={`bg-surface-container-lowest rounded-xl shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export default Card