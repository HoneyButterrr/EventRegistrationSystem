function DateField({ value, onChange }) {
	return <label>Date<input required type="date" value={value} onChange={onChange} /></label>
}

export default DateField
