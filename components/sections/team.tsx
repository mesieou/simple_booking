import React from "react";

const people = [
  {
    name: "Daniel Smith",
    role: "Developer",
    image:
      "https://randomuser.me/api/portraits/men/1.jpg",
    instagram: "#",
    facebook: "#",
    twitter: "#",
  },
  {
    name: "Luka Smith",
    role: "Developer",
    image:
      "https://randomuser.me/api/portraits/men/2.jpg",
    instagram: "#",
    facebook: "#",
    twitter: "#",
  },
  {
    name: "Juan Smith",
    role: "Developer",
    image:
      "https://randomuser.me/api/portraits/men/6.jpg",
    instagram: "#",
    facebook: "#",
    twitter: "#",
  }
];

type PersonProps = {
  name: string;
  role: string;
  image: string;
  instagram: string;
  facebook: string;
  twitter: string;
};

const PersonCard: React.FC<PersonProps> = ({ name, role, image, instagram, facebook, twitter }) => (
  <div className="flex flex-col items-center text-center">
    <img
      src={image}
      alt={name}
      className="w-32 h-32 rounded-full object-cover mb-4 border-4 border-white shadow-md"
      tabIndex={0}
      aria-label={`Foto de perfil de ${name}`}
    />
    <span className="font-semibold text-lg">{name}</span>
    <span className="text-gray-500 text-sm mb-2">{role}</span>
    <div className="flex gap-3 mt-1">
      <a
        href={instagram}
        aria-label="Instagram"
        tabIndex={0}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-500 hover:text-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-400 rounded-full"
      >
        {/* Instagram SVG */}
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5A4.25 4.25 0 0 0 20.5 16.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5zm4.25 3.25a5.25 5.25 0 1 1 0 10.5 5.25 5.25 0 0 1 0-10.5zm0 1.5a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5zm5.13.62a1.13 1.13 0 1 1-2.26 0 1.13 1.13 0 0 1 2.26 0z" />
        </svg>
      </a>
      <a
        href={facebook}
        aria-label="Facebook"
        tabIndex={0}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-500 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-full"
      >
        {/* Facebook SVG */}
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22 12c0-5.522-4.477-10-10-10S2 6.478 2 12c0 5 3.657 9.127 8.438 9.877v-6.987h-2.54v-2.89h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.242 0-1.632.771-1.632 1.562v1.875h2.773l-.443 2.89h-2.33v6.987C18.343 21.127 22 17 22 12" />
        </svg>
      </a>
      <a
        href={twitter}
        aria-label="Twitter"
        tabIndex={0}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-500 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-full"
      >
        {/* Twitter SVG */}
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22.46 6c-.77.35-1.6.59-2.47.69a4.3 4.3 0 0 0 1.88-2.37 8.59 8.59 0 0 1-2.72 1.04A4.28 4.28 0 0 0 16.11 4c-2.37 0-4.29 1.92-4.29 4.29 0 .34.04.67.11.99C7.69 9.13 4.07 7.38 1.64 4.7c-.37.64-.58 1.38-.58 2.17 0 1.5.76 2.82 1.92 3.6-.71-.02-1.38-.22-1.97-.54v.05c0 2.1 1.5 3.85 3.5 4.25-.36.1-.74.16-1.13.16-.28 0-.54-.03-.8-.08.54 1.7 2.11 2.94 3.97 2.97A8.6 8.6 0 0 1 2 19.54c-.29 0-.57-.02-.85-.05A12.13 12.13 0 0 0 8.29 21.5c7.55 0 11.68-6.26 11.68-11.68 0-.18-.01-.36-.02-.54A8.18 8.18 0 0 0 22.46 6z" />
        </svg>
      </a>
    </div>
  </div>
);

const Team: React.FC = () => (
  <section className="py-16 bg-white/20">
    <div className="max-w-4xl mx-auto text-center mb-12">
      <h2 className="text-3xl font-bold mb-2">Our team</h2>
      <p className="text-gray-600 max-w-2xl mx-auto">
        We are a team of developers passionate about creating software that helps businesses grow.
      </p>
    </div>
    <div className="flex justify-center">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-12 gap-x-8 place-items-center">
        {people.map((person, idx) => (
          <PersonCard key={idx} {...person} />
        ))}
      </div>
    </div>
  </section>
);

export default Team;
