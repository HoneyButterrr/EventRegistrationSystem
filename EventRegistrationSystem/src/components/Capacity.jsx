function Capacity({ value, onChange }) {
	return <label>Capacity<input required min="1" type="number" value={value} onChange={onChange} placeholder="100" /></label>
}

export default Capacity
