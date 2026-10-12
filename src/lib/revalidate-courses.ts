import { revalidatePath } from "next/cache";

// Call after any change to a course, its curriculum or its lessons.
// The public pages are rendered per request; this also clears the client router cache.
export function refreshCourses() {
  revalidatePath("/courses", "layout");
  revalidatePath("/admin/courses", "layout");
  revalidatePath("/instructor/courses", "layout");
  revalidatePath("/admin");
}
