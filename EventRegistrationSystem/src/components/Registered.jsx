function Registered({ value, capacity, onChange }) {
	return <label>Registered<input required min="0" max={capacity || undefined} type="number" value={value} onChange={onChange} placeholder="0" /></label>
}

export default Registered
