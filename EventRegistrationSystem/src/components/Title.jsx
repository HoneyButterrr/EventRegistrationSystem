function Title({ value, onChange }) {
	return <label>Title<input required value={value} onChange={onChange} placeholder="e.g. Community meetup" /></label>
}

export default Title
