export default function PalletLabel({ codigo, fecha, cantidad, orientation }) {
  const fechaFormateada = formatFecha(fecha)

  return (
    <div className={`label-sheet orientation-${orientation} flex flex-col bg-white font-sans text-black`}>
      {/* Header compacto: solo el logo */}
      <div className="flex shrink-0 items-center justify-end px-[3%] py-[1%]">
        <img
          src="/logo-vega.png"
          alt="VEGA"
          className="h-[clamp(20px,2.6cqw,34px)] w-auto object-contain"
        />
      </div>

      {/* Cuerpo: 3 filas tipo tabla */}
      <div className="flex min-h-0 flex-1 flex-col border-t-[3px] border-black">
        <LabelRow caption="Código" empty={!codigo}>
          <span className="text-[clamp(36px,12cqw,160px)]">
            {codigo || '—'}
          </span>
        </LabelRow>

        <LabelRow caption="Vencimiento" empty={!fecha}>
          <span className="text-[clamp(36px,12cqw,160px)]">
            {fechaFormateada || '—'}
          </span>
        </LabelRow>

        <LabelRow caption="Cantidad de cajas" empty={!cantidad} last>
          <span className="text-[clamp(36px,12cqw,160px)]">
            {cantidad || '0'}
          </span>
        </LabelRow>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t-[3px] border-black px-[4%] py-[1%] text-center text-[clamp(10px,1.4cqw,16px)] font-bold uppercase tracking-wide">
        Identificación de pallet
      </div>
    </div>
  )
}

function LabelRow({ caption, empty, last, children }) {
  const esMultiPalabra = caption.includes(' ')

  return (
    <div
      className={[
        'flex min-h-0 flex-1 items-stretch overflow-hidden',
        last ? '' : 'border-b-[3px] border-black',
      ].join(' ')}
    >
      {/* Caption izquierda — 22% */}
      <div className="flex w-[22%] shrink-0 items-center justify-center overflow-hidden border-r-[3px] border-black bg-neutral-100 px-1 text-center font-extrabold uppercase leading-[1.1] tracking-tight">
        {esMultiPalabra ? (
          <span className="text-[clamp(10px,2.4cqw,28px)] [text-wrap:balance]">
            {caption}
          </span>
        ) : (
          <span className="whitespace-nowrap text-[clamp(9px,2.6cqw,30px)]">
            {caption}
          </span>
        )}
      </div>

      {/* Valor derecha — 78% con padding generoso */}
      <div
        className={[
          'flex min-w-0 flex-1 items-center justify-center overflow-hidden px-4 font-black leading-none',
          empty ? 'text-neutral-300' : '',
        ].join(' ')}
      >
        <span className="w-full text-center whitespace-nowrap">{children}</span>
      </div>
    </div>
  )
}

function formatFecha(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}