export default function PalletLabel({ codigo, fecha, cantidad, orientation }) {
  const fechaFormateada = formatFecha(fecha)

  return (
    <div className={`label-sheet orientation-${orientation} flex flex-col bg-white font-sans text-black`}>
      <div className="flex shrink-0 items-center justify-end px-[3%] py-[1%]">
        <img
          src="/logo-vega.png"
          alt="VEGA"
          className="h-[clamp(20px,2.6cqw,34px)] w-auto object-contain"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t-[3px] border-black">
        <LabelRow caption="Código" empty={!codigo}>
          <span className="text-[clamp(28px,11cqw,110px)]">
            {codigo || '—'}
          </span>
        </LabelRow>

        <LabelRow caption="Vencimiento" empty={!fecha}>
          <span className="text-[clamp(28px,11cqw,110px)]">
            {fechaFormateada || '—'}
          </span>
        </LabelRow>

        <LabelRow caption="Cantidad de cajas" empty={!cantidad} last>
          <span className="text-[clamp(28px,11cqw,110px)]">
            {cantidad || '0'}
          </span>
        </LabelRow>
      </div>

      <div className="shrink-0 border-t-[3px] border-black px-[4%] py-[1%] text-center text-[clamp(10px,1.4cqw,16px)] font-bold uppercase tracking-wide">
        Identificación de pallet
      </div>
    </div>
  )
}

function LabelRow({ caption, empty, last, children }) {
  return (
    <div
      className={[
        'flex min-h-0 flex-1 items-stretch overflow-hidden',
        last ? '' : 'border-b-[3px] border-black',
      ].join(' ')}
    >
      {/* Caption izquierda — más angosto */}
      <div className="flex w-[24%] shrink-0 items-center justify-center overflow-hidden border-r-[3px] border-black bg-neutral-100 px-1.5 text-center text-[clamp(14px,4.2cqw,44px)] font-extrabold uppercase leading-[1.05] tracking-tight [overflow-wrap:anywhere]">
        {caption}
      </div>

      {/* Valor derecha */}
      <div
        className={[
          'flex min-w-0 flex-1 items-center justify-center overflow-hidden px-3 font-black leading-none',
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