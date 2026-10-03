import { useEffect, useMemo, useState } from 'react'
import './App.css'
import Capacity from './components/Capacity'
import DateField from './components/Date'
import Id from './components/Id'
import Location from './components/Location'
import Registered from './components/Registered'
import Title from './components/Title'

const initialEvents = []
const paymentMethods = ['Credit / Debit Card', 'GCash', 'Maya', 'PayPal', 'Bank Transfer']
const money = (amount) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(amount)
const qrCodeUrl = (ticketId) => `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(ticketId)}`
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]))

const formatDate = (date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
const formatToday = () => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())
const formatWeekRange = () => {
  const start = new Date()
  const day = start.getDay() || 7
  start.setDate(start.getDate() - day + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)} - ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(end)}`
}

function App() {
  const [events, setEvents] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('evently-events')) || initialEvents
    } catch {
      return initialEvents
    }
  })
  const [activeView, setActiveView] = useState('Overview')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All events')
  const [showModal, setShowModal] = useState(false)
  const [showRegistrationModal, setShowRegistrationModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ id: '', title: '', date: '', location: '', capacity: '', registered: '0', earlyBirdPrice: '0', regularPrice: '25', vipPrice: '75' })
  const [registrationForm, setRegistrationForm] = useState({ name: '', email: '', guests: '1', ticketType: 'Regular', paymentMethod: paymentMethods[0] })
  const [confirmedTicket, setConfirmedTicket] = useState(null)
  const [selectedBadge, setSelectedBadge] = useState(null)
  const [editingAttendee, setEditingAttendee] = useState(null)
  const [communication, setCommunication] = useState({ eventId: '', subject: '', message: '' })
  const [feedbackForm, setFeedbackForm] = useState({ ticketId: '', rating: '5', comment: '' })

  useEffect(() => {
    window.localStorage.setItem('evently-events', JSON.stringify(events))
  }, [events])

  const filteredEvents = useMemo(() => events.filter((event) => {
    const matchesQuery = `${event.title} ${event.location} ${event.id}`.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = statusFilter === 'All events' || (statusFilter === 'Available' && event.registered < event.capacity) || (statusFilter === 'Full' && event.registered >= event.capacity)
    return matchesQuery && matchesStatus
  }), [events, query, statusFilter])

  const totalRegistered = events.reduce((sum, event) => sum + event.registered, 0)
  const totalCapacity = events.reduce((sum, event) => sum + event.capacity, 0)
  const openSpots = events.reduce((sum, event) => sum + Math.max(event.capacity - event.registered, 0), 0)
  const recentRegistrations = useMemo(() => events.flatMap((event) => (event.registrants || []).map((attendee) => ({
    ...attendee,
    eventId: event.id,
    eventTitle: event.title,
    eventDate: event.date
  }))), [events])
  const totalRevenue = recentRegistrations.reduce((sum, attendee) => sum + (attendee.paymentStatus === 'Demo' ? attendee.amount : 0), 0)
  const checkedInCount = recentRegistrations.reduce((sum, attendee) => sum + (attendee.checkedIn ? attendee.guests : 0), 0)
  const attendanceRate = totalRegistered ? Math.round((checkedInCount / totalRegistered) * 100) : 0
  const feedbackEntries = recentRegistrations.filter((attendee) => attendee.feedback)
  const averageFeedback = feedbackEntries.length
    ? (feedbackEntries.reduce((sum, attendee) => sum + attendee.feedback.rating, 0) / feedbackEntries.length).toFixed(1)
    : '—'

  const getTicketPrice = (event, type) => Number(event.ticketPrices?.[type] ?? 0)

  const showNotice = (message) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2800)
  }

  const registerGuest = (eventId) => {
    const event = events.find((item) => item.id === eventId)
    if (!event) return
    setSelectedEvent(event)
    setRegistrationForm({ name: '', email: '', guests: '1', ticketType: 'Regular', paymentMethod: paymentMethods[0] })
    setShowRegistrationModal(true)
  }

  const submitRegistration = (event) => {
    event.preventDefault()
    if (!selectedEvent) return

    const guestCount = Number(registrationForm.guests)
    if (!registrationForm.name.trim() || !registrationForm.email.trim()) {
      showNotice('Please complete your name and email')
      return
    }
    if (!Number.isInteger(guestCount) || guestCount < 1) {
      showNotice('Guests must be at least 1')
      return
    }

    const remainingSpots = selectedEvent.capacity - selectedEvent.registered
    if (guestCount > remainingSpots) {
      showNotice('Not enough spots left for this event')
      return
    }

    const ticketPrice = getTicketPrice(selectedEvent, registrationForm.ticketType)
    const ticket = {
      ticketId: `EV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      name: registrationForm.name.trim(),
      email: registrationForm.email.trim(),
      guests: guestCount,
      ticketType: registrationForm.ticketType,
      paymentMethod: ticketPrice ? registrationForm.paymentMethod : 'No payment required',
      paymentStatus: ticketPrice ? 'Demo' : 'Free',
      amount: ticketPrice * guestCount,
      checkedIn: false,
      registeredAt: new Date().toISOString()
    }
    setEvents((current) => current.map((item) => item.id === selectedEvent.id ? {
      ...item,
      registered: item.registered + guestCount,
      registrants: [...(item.registrants || []), ticket]
    } : item))
    setShowRegistrationModal(false)
    setConfirmedTicket({ ...ticket, eventTitle: selectedEvent.title, eventDate: selectedEvent.date, eventLocation: selectedEvent.location })
    setSelectedEvent(null)
    showNotice(ticketPrice ? 'Demo checkout completed. No money was charged.' : 'Free ticket registration confirmed')
  }

  const createEvent = (event) => {
    event.preventDefault()
    const capacity = Number(form.capacity)
    const registered = Number(form.registered)
    const ticketValues = [form.earlyBirdPrice, form.regularPrice, form.vipPrice].map(Number)
    if (ticketValues.some((price) => !Number.isFinite(price) || price < 0)) {
      showNotice('Ticket prices must be zero or more')
      return
    }
    if (events.some((item) => item.id.toLowerCase() === form.id.trim().toLowerCase())) {
      showNotice('Event ID already exists')
      return
    }
    if (registered > capacity) {
      showNotice('Registered cannot exceed capacity')
      return
    }
    const colors = ['violet', 'peach', 'mint', 'sunset']
    const randomColor = colors[Math.floor(Math.random() * colors.length)]
    const newEvent = {
      ...form,
      id: form.id.trim(),
      capacity,
      registered,
      ticketPrices: { 'Early Bird': Number(form.earlyBirdPrice), Regular: Number(form.regularPrice), VIP: Number(form.vipPrice) },
      color: randomColor,
      registrants: []
    }
    setEvents((current) => [newEvent, ...current])
    setForm({ id: '', title: '', date: '', location: '', capacity: '', registered: '0', earlyBirdPrice: '0', regularPrice: '25', vipPrice: '75' })
    setShowModal(false)
    showNotice('New event created successfully')
  }

  const updateAttendee = (event) => {
    event.preventDefault()
    setEvents((current) => current.map((item) => item.id === editingAttendee.eventId ? {
      ...item,
      registrants: item.registrants.map((attendee) => {
        if (attendee.ticketId !== editingAttendee.ticketId) return attendee
        const ticketPrice = Number(item.ticketPrices?.[editingAttendee.ticketType] ?? 0)
        return {
          ...attendee,
          name: editingAttendee.name.trim(),
          email: editingAttendee.email.trim(),
          ticketType: editingAttendee.ticketType,
          amount: ticketPrice * attendee.guests,
          paymentStatus: ticketPrice ? 'Demo' : 'Free',
          paymentMethod: ticketPrice ? (attendee.paymentMethod === 'No payment required' ? paymentMethods[0] : attendee.paymentMethod) : 'No payment required'
        }
      })
    } : item))
    setEditingAttendee(null)
    showNotice('Attendee details updated')
  }

  const toggleCheckIn = (attendee) => {
    setEvents((current) => current.map((item) => item.id === attendee.eventId ? {
      ...item,
      registrants: item.registrants.map((entry) => entry.ticketId === attendee.ticketId ? { ...entry, checkedIn: !entry.checkedIn } : entry)
    } : item))
    showNotice(attendee.checkedIn ? 'Check-in reversed' : `Checked in ${attendee.name}`)
  }

  const sendCommunication = (event) => {
    event.preventDefault()
    const selected = events.find((item) => item.id === communication.eventId)
    const emails = [...new Set((selected?.registrants || []).map((attendee) => attendee.email))]
    if (!emails.length) {
      showNotice('No attendee email addresses for this event')
      return
    }
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent(communication.subject)}&body=${encodeURIComponent(communication.message)}`
    showNotice('Your email app is opening with the attendee list')
  }

  const saveFeedback = (event) => {
    event.preventDefault()
    const attendee = recentRegistrations.find((entry) => entry.ticketId === feedbackForm.ticketId)
    if (!attendee) return
    setEvents((current) => current.map((item) => item.id === attendee.eventId ? {
      ...item,
      registrants: item.registrants.map((entry) => entry.ticketId === attendee.ticketId ? {
        ...entry,
        feedback: { rating: Number(feedbackForm.rating), comment: feedbackForm.comment.trim() }
      } : entry)
    } : item))
    setFeedbackForm({ ticketId: '', rating: '5', comment: '' })
    showNotice('Post-event feedback saved')
  }

  const prepareEmailReceipt = () => {
    if (!confirmedTicket) return

    const ticket = confirmedTicket
    const safe = (value) => escapeHtml(value)
    const subject = `Your ticket for ${ticket.eventTitle}`.replace(/[\r\n]+/g, ' ')
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#302245"><h1>${safe(ticket.eventTitle)}</h1><p>Hello ${safe(ticket.name)}, your registration is confirmed.</p><img src="${qrCodeUrl(ticket.ticketId)}" alt="QR code for ${safe(ticket.ticketId)}" width="180" height="180"><p><strong>Ticket ID:</strong> ${safe(ticket.ticketId)}<br><strong>Date:</strong> ${safe(formatDate(ticket.eventDate))}<br><strong>Location:</strong> ${safe(ticket.eventLocation)}<br><strong>Ticket:</strong> ${safe(ticket.ticketType)} (${safe(ticket.guests)} seat${ticket.guests === 1 ? '' : 's'})<br><strong>Amount:</strong> ${safe(money(ticket.amount))}<br><strong>Payment:</strong> ${safe(ticket.paymentMethod)} (${safe(ticket.paymentStatus)})</p><p>This is a local demo receipt. No payment was processed.</p></body></html>`
    const emailFile = [
      `To: ${ticket.email.replace(/[\r\n]+/g, '')}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      html
    ].join('\r\n')
    const url = URL.createObjectURL(new Blob([emailFile], { type: 'message/rfc822' }))
    const download = document.createElement('a')
    download.href = url
    download.download = `ticket-${ticket.ticketId}.eml`
    document.body.appendChild(download)
    download.click()
    download.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    showNotice('Email receipt downloaded. Open the .eml file in your email app.')
  }

  const isOrganizerView = ['Attendees', 'Check-in', 'Communications', 'Reports'].includes(activeView)

  const isOverview = activeView === 'Overview'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">e</span>
          <span>evently</span>
        </div>
        
        <div className="workspace-switcher">
          <span className="workspace-dot">AM</span>
          <span>
            <strong>Acme Events</strong>
            <small>Workspace</small>
          </span>
          <span className="chevron">v</span>
        </div>

        <nav className="main-nav" aria-label="Main navigation" style={{ marginTop: '10px' }}>
          {['Overview', 'Events', 'Attendees', 'Check-in', 'Communications', 'Reports'].map((item) => (
            <button 
              key={item} 
              className={activeView === item ? 'nav-item active' : 'nav-item'} 
              onClick={() => setActiveView(item)}
              title={item}
              aria-label={item}
            >
              <span className={`nav-icon ${item.toLowerCase()}`} />
              <span>{item}</span>
              <span className="nav-arrow">{activeView === item ? '›' : ''}</span>
            </button>
          ))}
        </nav>
        
        <div className="sidebar-bottom">
          <div className="user-profile">
            <span className="avatar">AD</span>
            <div>
              <strong>Admin</strong>
              <small>admin@acme.co</small>
            </div>
            <span className="more">•••</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <button type="button" className="breadcrumb-link" onClick={() => setActiveView('Overview')}>
              Dashboard
            </button>
            <b>/</b>
            <strong>{activeView}</strong>
          </div>
          <div className="top-actions">
            <button className="create-button" onClick={() => setShowModal(true)}>
              <span>+</span> Create event
            </button>
          </div>
        </header>

        <div className="content-wrap">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">{formatToday()}</p>
                  <h1>{activeView === 'Overview' ? 'Good morning, Admin' : activeView}</h1>
                  <p className="subheading">{activeView === 'Overview' ? 'Here is what is happening with your events today.' : `Manage your event ${activeView.toLowerCase()} in one place.`}</p>
            </div>
            <div className="date-chip">
              <span className="calendar-icon" /> {formatWeekRange()} <span className="chevron">v</span>
            </div>
          </section>

          {isOverview && (
            <>
              {events.length === 0 && (
                <section className="empty-overview">
                  <div>
                    <p className="eyebrow">Your workspace is ready</p>
                    <h2>Make your first event memorable.</h2>
                    <p>Start with the details and we will keep every registration organized in one beautiful place.</p>
                  </div>
                  <div className="empty-orbit">
                    <div className="orbit-core">🦋</div>
                    <span className="orbit-dot one" />
                    <span className="orbit-dot two" />
                    <span className="orbit-dot three" />
                  </div>
                  <div className="empty-checklist">
                    <span><b>01</b> Event details</span>
                    <span><b>02</b> Guest list</span>
                    <span><b>03</b> Live capacity</span>
                  </div>
                </section>
              )}

              <section className="stats-grid" aria-label="Event summary">
                <article className="stat-card primary">
                  <div className="stat-top">
                    <span>Total events</span>
                    <span className="stat-icon calendar-icon" />
                  </div>
                  <strong>{events.length}</strong>
                  <p>Events in your workspace</p>
                  <div className="mini-bars">
                    <i /><i /><i /><i /><i /><i /><i />
                  </div>
                </article>

                <article className="stat-card">
                  <div className="stat-top">
                    <span>Total registrations</span>
                    <span className="stat-icon people-icon" />
                  </div>
                  <strong>{totalRegistered}</strong>
                  <p>Seats reserved across events</p>
                  <div className="sparkline">
                    <i /><i /><i /><i /><i /><i /><i /><i />
                  </div>
                </article>

                <article className="stat-card">
                  <div className="stat-top">
                    <span>Open spots</span>
                    <span className="stat-icon ticket-icon" />
                  </div>
                  <strong>{openSpots}</strong>
                  <p>Available across all events</p>
                  <div className="ring-progress">
                    <span>{totalCapacity ? Math.round((totalRegistered / totalCapacity) * 100) : 0}%</span>
                  </div>
                </article>
              </section>

              {recentRegistrations.length > 0 && (
                <section className="registrations-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Recent registrations</h2>
                      <p>See who has signed up for your events.</p>
                    </div>
                  </div>

                  <div className="registrations-list">
                    {recentRegistrations.slice(0, 8).map((entry, index) => (
                      <div key={`${entry.eventId}-${entry.email}-${index}`} className="registration-item">
                        <span className="avatar-mini">
                          {entry.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'GU'}
                        </span>
                        <div className="registration-copy">
                          <strong>{entry.name}</strong>
                          <small>{entry.eventTitle}</small>
                        </div>
                        <span className="registration-count">{entry.guests > 1 ? `${entry.guests} guests` : '1 guest'}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {activeView === 'Events' && (
            <section className="events-section">
              <div className="section-heading">
                <div>
                  <h2>Your events</h2>
                  <p>Keep track of all your upcoming events.</p>
                </div>
                <button className="text-button" onClick={() => setActiveView('Events')}>View all <span>-&gt;</span></button>
              </div>

              <div className="toolbar">
                <div className="search-box">
                  <span className="search-icon" />
                  <input 
                    aria-label="Search events" 
                    value={query} 
                    onChange={(event) => setQuery(event.target.value)} 
                    placeholder="Search events..." 
                  />
                </div>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter events">
                  <option>All events</option>
                  <option>Available</option>
                  <option>Full</option>
                </select>
                <button className="filter-button" onClick={() => setStatusFilter('All events')}>
                  <span className="filter-icon" /> Filters
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Event details</th>
                      <th>Date &amp; location</th>
                      <th>Capacity</th>
                      <th>Status</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((event) => { 
                      const percentage = Math.min(100, Math.round((event.registered / event.capacity) * 100)); 
                      const isFull = event.registered >= event.capacity; 
                      return (
                        <tr key={event.id}>
                          <td>
                            <div className="event-cell">
                              <span className={`event-thumb ${event.color || 'violet'}`}>
                                <span className="thumb-shape" />
                              </span>
                              <span>
                                <strong>{event.title}</strong>
                                <small>
                                  {event.id} - {event.registered} registered
                                  {event.registrants?.length > 0 ? ` • ${event.registrants.map((attendee) => attendee.name).slice(0, 2).join(', ')}` : ''}
                                </small>
                              </span>
                            </div>
                          </td>
                          <td>
                            <strong>{formatDate(event.date)}</strong>
                            <small>{event.location}</small>
                          </td>
                          <td>
                            <div className="capacity-cell">
                              <span>{event.registered} / {event.capacity}</span>
                              <div className="progress-track">
                                <i style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={isFull ? 'status full' : 'status open'}>
                              <i />{isFull ? 'Full' : 'Open'}
                            </span>
                          </td>
                          <td>
                            <button className="register-button" disabled={isFull} onClick={() => registerGuest(event.id)}>
                              {isFull ? 'Full' : 'Register'}
                            </button>
                          </td>
                        </tr>
                      ) 
                    })}
                  </tbody>
                </table>
                {filteredEvents.length === 0 && (
                  <div className="empty-state">
                    {events.length === 0 ? 'Create an event above to see it here.' : 'No events match your search.'}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeView === 'Attendees' && (
            <section className="events-section">
              <div className="section-heading">
                <div><h2>Attendee directory</h2><p>Update registration details and review each ticket.</p></div>
                <strong className="module-count">{recentRegistrations.length} registrations</strong>
              </div>
              <div className="table-wrap">
                <table className="attendee-table"><thead><tr><th>Attendee</th><th>Event</th><th>Ticket</th><th>Payment</th><th>Check-in</th><th /></tr></thead>
                  <tbody>{recentRegistrations.map((attendee) => <tr key={attendee.ticketId}>
                    <td><strong>{attendee.name}</strong><small>{attendee.email}</small></td>
                    <td><strong>{attendee.eventTitle}</strong><small>{attendee.guests} {attendee.guests === 1 ? 'seat' : 'seats'}</small></td>
                    <td>{attendee.ticketType || 'Regular'}</td>
                    <td><strong>{attendee.paymentStatus || 'Free'}</strong><small>{money(attendee.amount || 0)}</small></td>
                    <td><span className={attendee.checkedIn ? 'status open' : 'status full'}><i />{attendee.checkedIn ? 'Checked in' : 'Not arrived'}</span></td>
                    <td><button className="table-action" onClick={() => setEditingAttendee({ ...attendee })}>Edit</button></td>
                  </tr>)}</tbody>
                </table>
                {recentRegistrations.length === 0 && <div className="empty-state">Attendees will appear here after registration.</div>}
              </div>
            </section>
          )}

          {activeView === 'Check-in' && (
            <section className="events-section">
              <div className="section-heading"><div><h2>On-site check-in</h2><p>Search attendees or scan a ticket ID with a keyboard QR scanner.</p></div><strong className="module-count">{checkedInCount} / {totalRegistered} arrived</strong></div>
              <div className="toolbar"><div className="search-box"><span className="search-icon" /><input aria-label="Search or scan ticket ID" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  const scanned = recentRegistrations.find((attendee) => attendee.ticketId?.toLowerCase() === query.trim().toLowerCase())
                  if (scanned) {
                    toggleCheckIn(scanned)
                    setQuery('')
                  } else {
                    showNotice('No ticket found for that code')
                  }
                }
              }} placeholder="Search name, email, or scan ticket ID..." /></div></div>
              <div className="checkin-list">{recentRegistrations.filter((attendee) => `${attendee.name} ${attendee.email} ${attendee.ticketId}`.toLowerCase().includes(query.toLowerCase())).map((attendee) => <article className="checkin-row" key={attendee.ticketId}>
                <div><strong>{attendee.name}</strong><small>{attendee.ticketId} · {attendee.eventTitle} · {attendee.ticketType || 'Regular'} · {attendee.guests} seats</small></div>
                <button className={attendee.checkedIn ? 'checkin-button checked' : 'checkin-button'} onClick={() => toggleCheckIn(attendee)}>{attendee.checkedIn ? 'Undo check-in' : 'Check in'}</button>
              </article>)}{recentRegistrations.length === 0 && <div className="empty-state">No tickets to check in yet.</div>}</div>
            </section>
          )}

          {activeView === 'Communications' && (
            <section className="events-section">
              <div className="section-heading"><div><h2>Attendee email</h2><p>Prepare an event reminder, update, or post-event survey.</p></div></div>
              <form className="communication-form" onSubmit={sendCommunication}>
                <label>Event<select required value={communication.eventId} onChange={(event) => setCommunication({ ...communication, eventId: event.target.value })}><option value="">Choose an event</option>{events.map((event) => <option value={event.id} key={event.id}>{event.title}</option>)}</select></label>
                <label>Subject<input required value={communication.subject} onChange={(event) => setCommunication({ ...communication, subject: event.target.value })} placeholder="Event reminder" /></label>
                <label>Message<textarea required rows="6" value={communication.message} onChange={(event) => setCommunication({ ...communication, message: event.target.value })} placeholder="Write your message to attendees" /></label>
                <p className="form-note">Opens your default email app with attendee addresses in BCC. Sending depends on your email provider.</p>
                <button className="create-button" type="submit">Prepare email <span>→</span></button>
              </form>
            </section>
          )}

          {activeView === 'Reports' && (
            <section className="events-section">
              <div className="section-heading"><div><h2>Event performance</h2><p>Live totals calculated from saved registrations and check-ins.</p></div></div>
              <div className="report-grid">
                <article className="report-metric"><span>Simulated ticket total</span><strong>{money(totalRevenue)}</strong><small>Not collected; demo checkouts only</small></article>
                <article className="report-metric"><span>Seats registered</span><strong>{totalRegistered}</strong><small>Across {events.length} events</small></article>
                <article className="report-metric"><span>Attendance rate</span><strong>{attendanceRate}%</strong><small>{checkedInCount} checked-in seats</small></article>
              </div>
              <div className="table-wrap report-table"><table><thead><tr><th>Event</th><th>Registrations</th><th>Checked-in seats</th><th>Revenue</th><th>Capacity used</th></tr></thead><tbody>
                {events.map((event) => {
                  const attendees = event.registrants || []
                  const revenue = attendees.reduce((sum, attendee) => sum + (attendee.paymentStatus === 'Demo' ? attendee.amount : 0), 0)
                  const arrivals = attendees.reduce((sum, attendee) => sum + (attendee.checkedIn ? attendee.guests : 0), 0)
                  return <tr key={event.id}><td><strong>{event.title}</strong></td><td>{event.registered}</td><td>{arrivals}</td><td>{money(revenue)}</td><td>{event.capacity ? Math.round(event.registered / event.capacity * 100) : 0}%</td></tr>
                })}
              </tbody></table>{events.length === 0 && <div className="empty-state">Create an event to start reporting.</div>}</div>
            </section>
          )}
        </div>
      </main>

      {notice && (
        <div className="toast" role="status">
          <span>✓</span>{notice}
        </div>
      )}

      {showRegistrationModal && selectedEvent && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowRegistrationModal(false)}>
          <form className="modal registration-modal" onSubmit={submitRegistration}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Event registration</p>
                <h2>{selectedEvent.title}</h2>
              </div>
              <button type="button" className="close-button" onClick={() => setShowRegistrationModal(false)}>×</button>
            </div>

            <div className="event-summary">
              <span>{selectedEvent.id}</span>
              <span>{formatDate(selectedEvent.date)}</span>
              <span>{selectedEvent.location}</span>
            </div>

            <label>
              Full name
              <input value={registrationForm.name} onChange={(event) => setRegistrationForm({ ...registrationForm, name: event.target.value })} placeholder="Juan Dela Cruz" />
            </label>

            <label>
              Email address
              <input type="email" value={registrationForm.email} onChange={(event) => setRegistrationForm({ ...registrationForm, email: event.target.value })} placeholder="juan@email.com" />
            </label>

            <label>
              Ticket type
              <select value={registrationForm.ticketType} onChange={(event) => setRegistrationForm({ ...registrationForm, ticketType: event.target.value })}>
                {['Early Bird', 'Regular', 'VIP'].map((type) => <option key={type} value={type}>{type} · {getTicketPrice(selectedEvent, type) ? money(getTicketPrice(selectedEvent, type)) : 'Free'}</option>)}
              </select>
            </label>

            <label>
              Number of tickets
              <input type="number" min="1" max={Math.max(selectedEvent.capacity - selectedEvent.registered, 1)} value={registrationForm.guests} onChange={(event) => setRegistrationForm({ ...registrationForm, guests: event.target.value })} />
            </label>

            {getTicketPrice(selectedEvent, registrationForm.ticketType) > 0 && <label>
              Payment method
              <select value={registrationForm.paymentMethod} onChange={(event) => setRegistrationForm({ ...registrationForm, paymentMethod: event.target.value })}>
                {paymentMethods.map((method) => <option key={method}>{method}</option>)}
              </select>
            </label>}

            <div className="registration-meta">
              <span>{selectedEvent.capacity - selectedEvent.registered} spots left</span>
              <strong>Total: {money(getTicketPrice(selectedEvent, registrationForm.ticketType) * Number(registrationForm.guests || 0))}</strong>
            </div>

            <button className="create-button modal-submit" type="submit">
              {getTicketPrice(selectedEvent, registrationForm.ticketType) ? 'Continue to demo checkout' : 'Get free ticket'} <span>-&gt;</span>
            </button>
            <p className="form-note">Demo checkout only. No card or wallet is charged.</p>
          </form>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowModal(false)}>
          <form className="modal" onSubmit={createEvent}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">New listing</p>
                <h2>Create an event</h2>
              </div>
              <button type="button" className="close-button" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <Id value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} />
            <Title value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            <DateField value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            <Location value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            
            <div className="form-grid">
              <Capacity value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} />
              <Registered value={form.registered} capacity={form.capacity} onChange={(event) => setForm({ ...form, registered: event.target.value })} />
            </div>

            <fieldset className="pricing-fields">
              <legend>Ticket pricing (PHP)</legend>
              <label>Early Bird<input type="number" min="0" step="0.01" required value={form.earlyBirdPrice} onChange={(event) => setForm({ ...form, earlyBirdPrice: event.target.value })} /></label>
              <label>Regular<input type="number" min="0" step="0.01" required value={form.regularPrice} onChange={(event) => setForm({ ...form, regularPrice: event.target.value })} /></label>
              <label>VIP<input type="number" min="0" step="0.01" required value={form.vipPrice} onChange={(event) => setForm({ ...form, vipPrice: event.target.value })} /></label>
            </fieldset>

            <button className="create-button modal-submit" type="submit">
              Create event <span>-&gt;</span>
            </button>
          </form>
        </div>
      )}

      {confirmedTicket && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setConfirmedTicket(null)}>
          <section className="modal ticket-confirmation" aria-labelledby="ticket-title">
            <div className="modal-header"><div><p className="eyebrow">Registration complete</p><h2 id="ticket-title">Your digital ticket</h2></div><button type="button" className="close-button" onClick={() => setConfirmedTicket(null)} aria-label="Close">×</button></div>
            <div className="ticket-paper">
              <div><strong>{confirmedTicket.eventTitle}</strong><span>{formatDate(confirmedTicket.eventDate)} · {confirmedTicket.eventLocation}</span></div>
              <img src={qrCodeUrl(confirmedTicket.ticketId)} alt={`QR ticket code ${confirmedTicket.ticketId}`} />
              <strong className="ticket-code">{confirmedTicket.ticketId}</strong>
              <span>{confirmedTicket.name} · {confirmedTicket.ticketType} · {confirmedTicket.guests} ticket(s)</span>
              <span>{confirmedTicket.paymentStatus} · {money(confirmedTicket.amount)}</span>
              <span>Payment: {confirmedTicket.paymentMethod}</span>
            </div>
            <div className="ticket-actions">
              <button type="button" className="text-button" onClick={() => window.print()}>Print / save ticket</button>
              <button type="button" className="create-button" onClick={prepareEmailReceipt}>Prepare email receipt</button>
            </div>
            <p className="form-note">Downloads an email draft with the ticket details and QR code. Open the .eml file in your email app to review and send; it is not sent automatically.</p>
          </section>
        </div>
      )}

      {editingAttendee && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditingAttendee(null)}>
          <form className="modal" onSubmit={updateAttendee}>
            <div className="modal-header"><div><p className="eyebrow">Attendee management</p><h2>Edit attendee</h2></div><button type="button" className="close-button" onClick={() => setEditingAttendee(null)} aria-label="Close">×</button></div>
            <label>Full name<input required value={editingAttendee.name} onChange={(event) => setEditingAttendee({ ...editingAttendee, name: event.target.value })} /></label>
            <label>Email address<input required type="email" value={editingAttendee.email} onChange={(event) => setEditingAttendee({ ...editingAttendee, email: event.target.value })} /></label>
            <label>Ticket type<select value={editingAttendee.ticketType} onChange={(event) => setEditingAttendee({ ...editingAttendee, ticketType: event.target.value })}>{['Early Bird', 'Regular', 'VIP'].map((type) => <option key={type}>{type}</option>)}</select></label>
            <button className="create-button modal-submit" type="submit">Save changes</button>
          </form>
        </div>
      )}
    </div>
  )
}

export default App