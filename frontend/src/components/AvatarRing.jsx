export const AvatarRing = ({ src, size = "", alt = "", initials, ...props }) => (
  <span className={`avatar-ring ${size}`} data-testid="avatar-ring" {...props}>
    {src ? (
      <img src={src} alt={alt} />
    ) : initials ? (
      <span className="ar-initials">{initials}</span>
    ) : (
      <i />
    )}
  </span>
);
