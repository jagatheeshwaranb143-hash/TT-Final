from fastapi import APIRouter, Depends, Query, Response, status
import io
import logging

from app.core.security import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/generate", summary="Generate a QR code for a specific timetable entity")
async def generate_qr_code(
    entity_type: str = Query(..., description="Type of entity: room, class, or faculty", regex="^(room|class|faculty)$"),
    entity_id: str = Query(..., description="UUID of the entity"),
    current_user=Depends(get_current_user)
):
    """
    Generate a PNG QR code that links directly to the timetable for a specific room, class, or faculty.
    These can be printed and placed on doors.
    """
    try:
        # Base URL would ideally come from settings, hardcoded for demonstration
        base_url = "https://app.smartschedule.edu"
        
        url_mapping = {
            "room": f"{base_url}/timetable/rooms/{entity_id}",
            "class": f"{base_url}/timetable/classes/{entity_id}",
            "faculty": f"{base_url}/timetable/faculty/{entity_id}",
        }
        
        target_url = url_mapping.get(entity_type)
        if not target_url:
            return Response(status_code=status.HTTP_400_BAD_REQUEST, content="Invalid entity type")
            
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(target_url)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        
        return Response(
            content=img_byte_arr.read(), 
            media_type="image/png",
            headers={"Content-Disposition": f'inline; filename="qr_{entity_type}_{entity_id}.png"'}
        )
    except Exception as e:
        logger.error(f"Failed to generate QR code: {e}")
        return Response(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content="Failed to generate QR code")
