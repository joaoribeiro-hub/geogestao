from app.supabase_repo import _bbox_intersects


def test_recent_geotiff_bbox_intersection():
    assert _bbox_intersects([-50, -20, -49, -19], [-49.5, -19.5, -48, -18])
    assert not _bbox_intersects([-50, -20, -49, -19], [-48, -18, -47, -17])
