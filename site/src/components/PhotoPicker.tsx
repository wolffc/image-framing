import { type Photo, photos } from '../photos'

/** Buttons to switch the sample photo; every widget shows the same one. */
export function PhotoPicker({
  onChange,
  photo,
}: {
  onChange: (photo: Photo) => void
  photo: Photo
}) {
  return (
    <div aria-label="Sample photo" className="picker" role="group">
      {photos.map((option) => (
        <button
          aria-pressed={option.id === photo.id}
          key={option.id}
          onClick={() => onChange(option)}
          title={`${option.title}: ${option.note}`}
          type="button"
        >
          <img alt="" src={option.src} />
          <span>{option.title}</span>
        </button>
      ))}
    </div>
  )
}
