import Link from 'next/link';
import { BookOpen, Building2, CalendarCheck, GraduationCap, HandHeart, HeartHandshake, Settings, Sparkles, Target, UsersRound, WandSparkles } from 'lucide-react';

const handlingSteps = [
  { icon: Building2, title: 'Set up the department', text: 'Create the department and confirm its name and code before adding academic data.', href: '/departments', action: 'Manage departments' },
  { icon: UsersRound, title: 'Add faculty', text: 'Register faculty members and keep their subject assignments and availability accurate.', href: '/faculty', action: 'Manage faculty' },
  { icon: GraduationCap, title: 'Create classes', text: 'Add each year and section under the correct odd or even semester.', href: '/classes', action: 'Manage classes' },
  { icon: BookOpen, title: 'Configure subjects', text: 'Set weekly periods, subject type, laboratory requirements, and assigned faculty.', href: '/subjects', action: 'Manage subjects' },
  { icon: WandSparkles, title: 'Generate in sequence', text: 'Choose Odd Semester or Even Semester, then build each semester from first year to final year.', href: '/timetable/generate', action: 'Generate timetable' },
  { icon: CalendarCheck, title: 'Review and use', text: 'Check class and faculty schedules, resolve data issues, and export the final timetable.', href: '/timetable', action: 'View timetables' },
];

export default function AboutPage() {
  return (
    <div className="info-page about-page">
      <section className="info-hero">
        <div className="info-icon"><Sparkles size={28} /></div>
        <div>
          <span>About SEC SchedX</span>
          <h1>Understand, Set Up &amp; Run SEC SchedX</h1>
          <p><strong>SEC SchedX</strong> is a smart academic scheduling workspace for managing departments, faculty, classes, subjects, and conflict-free semester timetables.</p>
        </div>
      </section>

      <section className="about-guide" aria-labelledby="handling-title">
        <div className="about-guide-heading">
          <div><span className="about-eyebrow">How to handle SEC SchedX</span><h2 id="handling-title">Recommended workflow</h2></div>
          <p>Complete the setup in this order so timetable generation has all required information.</p>
        </div>
        <div className="about-workflow-grid">
          {handlingSteps.map(({ icon: Icon, title, text, href, action }, index) => (
            <article className="info-card about-workflow-card" key={title}>
              <div className="about-step-number">{index + 1}</div>
              <Icon size={23} />
              <h3>{title}</h3>
              <p>{text}</p>
              <Link href={href}>{action} →</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="info-details about-operations">
        <div className="about-section-heading"><Settings size={24} /><div><span>Operating guidance</span><h2>Important details</h2></div></div>
        <ul>
          <li><strong>Use the correct order:</strong> department → faculty → classes → subjects → timetable.</li>
          <li><strong>Choose one semester type:</strong> generate the Odd or Even cycle semester by semester.</li>
          <li><strong>Keep earlier stages fixed:</strong> later-year generation reserves faculty and periods already used by earlier years.</li>
          <li><strong>Regenerate after data changes:</strong> update the affected timetable whenever faculty, subjects, or class details change.</li>
          <li><strong>Use Settings:</strong> maintain the default semester type, institution details, working periods, appearance, and PDF format.</li>
        </ul>
      </section>

      <div className="about-divider-heading"><span className="about-eyebrow">People behind the project</span><h2>Developers &amp; Contributors</h2></div>
      <section className="about-team-grid" aria-label="SEC SchedX project team">
        <article className="info-card about-card">
          <UsersRound size={25} />
          <div><span className="about-eyebrow">Developed by</span><h2>Project Developers</h2></div>
          <ul className="about-name-list"><li>Mr. S. Kishore</li><li>Mr. B. Jagatheeshwaran</li></ul>
          <p className="about-department">Department of <strong>AI &amp; DS</strong></p>
        </article>

        <article className="info-card about-card">
          <GraduationCap size={25} />
          <div><span className="about-eyebrow">Project guides</span><h2>Guidance &amp; Mentorship</h2></div>
          <ul className="about-name-list"><li>Mr. J. D. Praveen Kumar</li><li>Mr. M. Mohamed Basil</li><li>Mr. B. Saravanakumar</li></ul>
          <p className="about-department">Department of <strong>AI &amp; DS</strong></p>
        </article>
      </section>

      <section className="info-details about-thanks">
        <div className="about-section-heading"><HeartHandshake size={24} /><div><span>Special thanks</span><h2>With Sincere Gratitude</h2></div></div>
        <h3>Mrs. Porkodi</h3>
        <p className="about-role">Former Head of the Department (HOD), Department of AI &amp; DS</p>
        <p>We sincerely thank her for her valuable guidance, support, encouragement, and contribution to our department and project.</p>
      </section>

      <section className="about-purpose-grid">
        <article className="info-card about-purpose-card"><Target size={24} /><div><span className="about-eyebrow">Our goal</span><h2>Smarter Academic Planning</h2><p>To reduce manual work, avoid timetable conflicts, and provide a simple platform for managing <strong>departments, faculty, subjects, classes, and timetables</strong>.</p></div></article>
        <article className="info-card about-purpose-card"><HandHeart size={24} /><div><span className="about-eyebrow">Thank you</span><h2>Our Appreciation</h2><p>We sincerely thank our <strong>HOD, project guides, faculty members, and department</strong> for their valuable support and encouragement in developing <strong>SEC SchedX</strong>.</p></div></article>
      </section>

      <div className="about-action"><Link href="/timetable" className="btn btn-primary">Open timetable</Link></div>
    </div>
  );
}
