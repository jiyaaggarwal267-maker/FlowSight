function Icon({ name, className = "text-[20px]", ...rest }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden="true" {...rest}>
      {name}
    </span>
  )
}

export default Icon
