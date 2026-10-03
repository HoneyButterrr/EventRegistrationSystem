function Location({ value, onChange }) {
	return <label>Location<input required value={value} onChange={onChange} placeholder="Venue or online" /></label>
}

export default Location
