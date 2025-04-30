import NextLogo from "./next-logo";
import SupabaseLogo from "./supabase-logo";
import Video from 'next-video';
import botDemo from '/videos/bot-demo.mp4';
import JoinWaitlist  from "@/components/waitlist-form";

export default function Header() {
  return (
    <div className="flex flex-col gap-16 items-center">
      <div className="flex flex-col-reverse md:flex-row gap-8 justify-center items-center">
        <div className="w-full sm:w-3/4 md:w-1/2 lg:w-1/3 h-auto rounded-lg shadow-lg">
          <Video
            src={botDemo}
            autoplay
            muted
          />
        </div>  
        <div className="flex flex-col justify-evenly">
          <p className="text-3xl lg:text-4xl !leading-tight mx-auto max-w-xl text-center">
            We help mobile business to manage their bookings and calendars with smart agents{" "}
          </p>
          <div className="mt-32">
            <JoinWaitlist />  
          </div> 
        </div>
      </div>
      <div className="w-full p-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent my-8" />''
    </div>
  );
}
