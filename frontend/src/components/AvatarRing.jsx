export const AvatarRing = ({ src, size = "", alt = "", ...props }) => (
  <span className={`avatar-ring ${size}`} data-testid="avatar-ring" {...props}>
    {src ? <img src={src} alt={alt} /> : <i />}
  </span>
);
