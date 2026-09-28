import React from 'react'
import { Github, ExternalLink } from 'lucide-react'

const APP_NAME = 'QP Generator'

const AUTHOR = {
    name: 'Thilagavathi',
    github: 'https://github.com/Thilagavathi-04',
    portfolio: 'https://portfolio-iota-ochre-49.vercel.app',
    avatar: 'https://avatars.githubusercontent.com/u/198690416?v=4',
}

const GUIDE = 'Mrs. Hemalatha'

const STEPS = [
    {
        title: 'Add your subjects',
        body: 'Create a subject, then list the units and topics you teach. This is the starting point for everything else.',
    },
    {
        title: 'Keep every question in one place',
        body: 'Write questions yourself or ask the app to write them for you. They all land in a single question bank you can search, edit and reuse.',
    },
    {
        title: 'Decide the shape of the paper',
        body: 'Say how many questions you want and how difficult each one should be. The app also makes sure the same picture or question never appears twice.',
    },
    {
        title: 'Build and print',
        body: 'One click puts together a finished paper. Download it as a PDF or a Word file, or print it straight away.',
    },
    {
        title: 'Check the answers',
        body: "Once students reply, their answers are scored automatically with short remarks on what went well and what was missed — so you can see at a glance who needs more help.",
    },
]

const About = () => {
    return (
        <div className="about-layout">
            <div className="about-main">
                <header className="page-header">
                    <h1 className="page-title">About this app</h1>
                    <p className="page-subtitle">
                        What {APP_NAME} does, who it is for, and who built it.
                    </p>
                </header>

                <section className="card">
                    <div className="card-header">
                        <h2 className="card-title">What {APP_NAME} is</h2>
                    </div>

                    <div className="about-prose">
                        <p>
                            {APP_NAME} is a small web app that takes the busy work out of making
                            exam papers. Instead of writing every question by hand, hunting for
                            duplicates and assembling the sheet yourself, you add your subjects
                            once and the app does the assembling for you.
                        </p>
                        <p>
                            It also handles what comes after the exam. Students' answers are
                            checked, scored and given short remarks, so you know straight away
                            who understood the topic and who needs a little more help.
                        </p>
                        <p>
                            Nothing here requires any technical knowledge. Everything happens
                            through ordinary forms, buttons and menus on the screen.
                        </p>
                    </div>

                    <div className="about-block">
                        <h2 className="card-title">What it does for you</h2>
                        <ol className="about-steps">
                            {STEPS.map((step, index) => (
                                <li key={step.title} className="about-step">
                                    <span className="about-step-num" aria-hidden="true">
                                        {index + 1}
                                    </span>
                                    <div className="about-step-text">
                                        <h3>{step.title}</h3>
                                        <p>{step.body}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>
            </div>

            <aside className="about-aside">
                <div className="card about-aside-card">
                    <div className="card-header">
                        <h2 className="card-title">Who made it</h2>
                    </div>

                    <div className="about-identity">
                        <img
                            className="about-author-avatar"
                            src={AUTHOR.avatar}
                            alt=""
                            width="56"
                            height="56"
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                        />
                        <span className="about-author-name">{AUTHOR.name}</span>
                    </div>

                    <p className="about-author-bio">
                        Built {APP_NAME} as a complete exam workflow — from writing the
                        questions to grading the answers — so teachers can spend their time
                        teaching instead of formatting papers.
                    </p>

                    <div className="about-author-links">
                        <a href={AUTHOR.github} target="_blank" rel="noreferrer noopener">
                            <Github size={16} aria-hidden="true" />
                            GitHub
                        </a>
                        <a href={AUTHOR.portfolio} target="_blank" rel="noreferrer noopener">
                            <ExternalLink size={16} aria-hidden="true" />
                            Portfolio
                        </a>
                    </div>

                    <div className="about-guide-row">
                        <span className="about-guide-label">Guide</span>
                        <span className="about-author-name">{GUIDE}</span>
                    </div>
                </div>
            </aside>
        </div>
    )
}

export default About
