// Enter moves to the next input instead of submitting, so a shopkeeper can type a whole item without tapping
export function focusNextOnEnter(e) {
  if (e.key !== 'Enter') return
  const form = e.target.form
  if (!form) return
  const inputs = Array.from(
    form.querySelectorAll('input:not([type=file]):not([type=checkbox]), select, textarea'),
  ).filter((el) => !el.disabled && !el.readOnly)
  const next = inputs[inputs.indexOf(e.target) + 1]
  e.preventDefault()
  if (next) next.focus()
}
