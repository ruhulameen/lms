// Typography for rich text, shared by the editor and the site renderer so what
// authors see while writing matches the published article. Matches the blog
// article page.
export const richTextClasses = [
  "[&_p]:mb-6 [&_p]:leading-[1.8] [&_p]:text-gray-700",
  "[&_h2]:mt-10 [&_h2]:mb-5 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-navy md:[&_h2]:text-[1.75rem]",
  "[&_h3]:mt-8 [&_h3]:mb-4 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-navy",
  "[&_h4]:mt-6 [&_h4]:mb-3 [&_h4]:text-lg [&_h4]:font-bold [&_h4]:text-navy",
  "[&_blockquote]:my-7 [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-4 [&_blockquote]:border-blue-600 [&_blockquote]:bg-blue-50 [&_blockquote]:px-6 [&_blockquote]:py-5 [&_blockquote]:text-blue-900 [&_blockquote]:italic [&_blockquote_p]:mb-0 [&_blockquote_p]:text-blue-900",
  "[&_ul]:mb-6 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul]:leading-relaxed [&_ul]:text-gray-700",
  "[&_ol]:mb-6 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_ol]:leading-relaxed [&_ol]:text-gray-700",
  "[&_li_p]:mb-0",
  "[&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-blue-800",
  "[&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-slate-100",
  "[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_hr]:my-8 [&_hr]:border-gray-200",
  "[&_img]:my-8 [&_img]:h-auto [&_img]:w-full [&_img]:rounded-xl",
].join(" ");
